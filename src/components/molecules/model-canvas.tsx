"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { io, Socket } from "socket.io-client";
import ModelLoader from "../atoms/model-loader";
import { Move } from "../atoms/model-arrow";
import ModelEnv from "../atoms/model-env";
import SubjectPresence, { TrackedSubject } from "../atoms/subject-presence";
import GlassOrb3DProjection from "../atoms/glass-orb-3d-projection";
import GlassOrbProjection, {
  DEFAULT_GLASS_ORB_SETTINGS,
  GlassOrbSettings,
  HeadXAxisMapping,
  HeadYAxisMapping,
  OrbRotationSnapshot,
} from "../atoms/glass-orb-projection";
import {
  CONFIG,
  DirectionTuple,
  ProjectId,
  SUPABASE_URL,
  TLanguage,
} from "@/config/config";
import { usePathname, useRouter } from "next/navigation";
import SubtitleText from "./subtitle-text";
import EquirectangularView from "./equirectangular-view";
import { useLanguageContext } from "@/contexts/language-context";
import useRestrictedUiAccess from "@/hooks/useRestrictedUiAccess";
import {
  getLocalAssetFallbackPath,
  isVideoMediaUrl,
} from "./model-canvas-media";
import { useActiveMediaTexture } from "./model-canvas-texture";
import {
  OverlayLayoutSettings,
  useModelCanvasModes,
} from "@/hooks/useModelCanvasModes";

const ORB_AUTOPLAY_INTERVAL_MS = 2600;
const ORB_AUTOPLAY_START_INDEX = 1;
const ORB_AUTOPLAY_END_INDEX = 30;
const ORB_AUTOPLAY_VIDEO_FALLBACK_MS = 8000;
const ORB_SYNC_POLL_INTERVAL_MS = 120;
const ORB_SYNC_CAMERA_SEND_INTERVAL_MS = 120;
const ORB_SYNC_ROTATION_SEND_INTERVAL_MS = 120;
const ORB_SYNC_HEARTBEAT_INTERVAL_MS = 2000;
const ORB_TONE_MAPPING_EXPOSURE = 1.15;
const SPHERE_TONE_MAPPING_EXPOSURE = 1.05;
const PROJECTS_WITH_LOCAL_ASSET_FALLBACK = new Set<ProjectId>([
  "new-york-city",
]);
const PROJECT_MEDIA_PRELOAD_CONCURRENCY_DESKTOP = 6;
const PROJECT_MEDIA_PRELOAD_CONCURRENCY_TOUCH = 2;
const PROJECT_MEDIA_PRIORITY_AHEAD_COUNT = 3;
const PROJECT_MEDIA_PRIORITY_BEHIND_COUNT = 1;
const PROJECT_MEDIA_BLOCKING_PRIORITY_COUNT = 1;
const preloadedProjects = new Set<ProjectId>();

const drainResponseBody = async (response: Response) => {
  if (!response.body) {
    await response.arrayBuffer();
    return;
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) {
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
};

const preloadSceneMedia = async (
  mediaUrl: string,
  useLocalAssetFallback: boolean,
  signal: AbortSignal,
) => {
  const fallbackMediaUrl = useLocalAssetFallback
    ? getLocalAssetFallbackPath(mediaUrl)
    : null;
  const candidateSources = [mediaUrl, fallbackMediaUrl]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .filter((value, index, all) => all.indexOf(value) === index);

  for (const source of candidateSources) {
    try {
      const response = await fetch(source, {
        cache: "force-cache",
        signal,
      });

      if (!response.ok) {
        continue;
      }

      await drainResponseBody(response);
      return;
    } catch {
      if (signal.aborted) {
        return;
      }
    }
  }
};

const getPrioritizedPreloadIndices = (activeIndex: number, total: number) => {
  if (total <= 0) {
    return {
      orderedIndices: [] as number[],
      priorityCount: 0,
    };
  }

  const clampedActiveIndex = Math.min(Math.max(activeIndex, 0), total - 1);
  const priorityIndices: number[] = [];
  const seen = new Set<number>();
  const pushIfValid = (index: number) => {
    if (index < 0 || index >= total || seen.has(index)) {
      return;
    }
    seen.add(index);
    priorityIndices.push(index);
  };

  pushIfValid(clampedActiveIndex);
  for (let step = 1; step <= PROJECT_MEDIA_PRIORITY_AHEAD_COUNT; step += 1) {
    pushIfValid(clampedActiveIndex + step);
  }
  for (let step = 1; step <= PROJECT_MEDIA_PRIORITY_BEHIND_COUNT; step += 1) {
    pushIfValid(clampedActiveIndex - step);
  }

  const orderedIndices = [...priorityIndices];
  for (let index = 0; index < total; index += 1) {
    if (!seen.has(index)) {
      orderedIndices.push(index);
    }
  }

  return {
    orderedIndices,
    priorityCount: priorityIndices.length,
  };
};

const parseRotationOffsetToRadians = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized.length) {
      return null;
    }

    if (normalized.endsWith("deg")) {
      const numericPart = Number.parseFloat(normalized.slice(0, -3).trim());
      if (!Number.isFinite(numericPart)) {
        return null;
      }

      return (numericPart * Math.PI) / 180;
    }

    if (normalized.endsWith("rad")) {
      const numericPart = Number.parseFloat(normalized.slice(0, -3).trim());
      return Number.isFinite(numericPart) ? numericPart : null;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const getMediaPath = (projectId: ProjectId, textureIdx: number) => {
  const projectConfig = CONFIG[projectId];
  const perIndexMedia = projectConfig.mediaByIndex?.[textureIdx];
  if (perIndexMedia) {
    return perIndexMedia;
  }

  const extension = projectConfig.supabaseMediaExtension ?? "jpg";
  const prefix = projectConfig.mediaPrefixPath ?? projectConfig.supabasePrefixPath;

  return (
    SUPABASE_URL +
    projectConfig.supabaseFolder +
    "/" +
    prefix +
    "_" +
    textureIdx +
    "." +
    extension
  );
};

const orbControlRanges: Array<{
  id: keyof Pick<
    GlassOrbSettings,
    "radius" | "yaw" | "xRotation" | "zRotation" | "xOffset" | "yOffset"
  >;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { id: "radius", label: "Orb Size", min: 1.2, max: 4, step: 0.01 },
  {
    id: "xOffset",
    label: "X Position",
    min: -2.5,
    max: 2.5,
    step: 0.01,
  },
  {
    id: "yOffset",
    label: "Y Position",
    min: -2.5,
    max: 2.5,
    step: 0.01,
  },
];

type CameraOption = {
  id: string;
  label: string;
};

type RotationOffsets = {
  x: number;
  y: number;
  z: number;
};

const DEFAULT_ROTATION_OFFSETS: RotationOffsets = {
  x: -2.12,
  y: 0,
  z: 1.8,
};

const OrbControls: React.FC<{
  settings: GlassOrbSettings;
  onChange: React.Dispatch<React.SetStateAction<GlassOrbSettings>>;
  rotationOffsets: RotationOffsets;
  onRotationOffsetsChange: React.Dispatch<React.SetStateAction<RotationOffsets>>;
  liveRotationPreview: OrbRotationSnapshot | null;
  onHide: () => void;
  overlayLayoutSettings: OverlayLayoutSettings;
  onOverlayLayoutSettingsChange: React.Dispatch<
    React.SetStateAction<OverlayLayoutSettings>
  >;
  overlayPositionEditEnabled: boolean;
  onOverlayPositionEditEnabledChange: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  cameraEnabled: boolean;
  onCameraEnabledChange: React.Dispatch<React.SetStateAction<boolean>>;
  cameraBackdropEnabled: boolean;
  onCameraBackdropEnabledChange: React.Dispatch<React.SetStateAction<boolean>>;
  cameraBackdropOpacity: number;
  onCameraBackdropOpacityChange: React.Dispatch<React.SetStateAction<number>>;
  headFollowPositionEnabled: boolean;
  onHeadFollowPositionEnabledChange: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  headFollowPositionStrength: number;
  onHeadFollowPositionStrengthChange: React.Dispatch<
    React.SetStateAction<number>
  >;
  headXAxisMapping: HeadXAxisMapping;
  headYAxisMapping: HeadYAxisMapping;
  onHeadXAxisMappingChange: React.Dispatch<React.SetStateAction<HeadXAxisMapping>>;
  onHeadYAxisMappingChange: React.Dispatch<React.SetStateAction<HeadYAxisMapping>>;
  isolateHeadXDebug: boolean;
  onIsolateHeadXDebugChange: React.Dispatch<React.SetStateAction<boolean>>;
  isolateHeadYDebug: boolean;
  onIsolateHeadYDebugChange: React.Dispatch<React.SetStateAction<boolean>>;
  rotationAxisDebugEnabled: boolean;
  onRotationAxisDebugEnabledChange: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  cameraDeviceId: string;
  onCameraDeviceIdChange: React.Dispatch<React.SetStateAction<string>>;
  cameraOptions: CameraOption[];
  flipX: boolean;
  onFlipXChange: React.Dispatch<React.SetStateAction<boolean>>;
  flipY: boolean;
  onFlipYChange: React.Dispatch<React.SetStateAction<boolean>>;
  listenerMode: boolean;
  onListenerModeChange: (enabled: boolean) => void;
  isBroadcaster: boolean;
  activeBroadcasterId: string | null;
  syncWarning: string | null;
  remotePointerControlEnabled: boolean;
  onRemotePointerControlEnabledChange: (enabled: boolean) => void;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  autoplayEnabled: boolean;
  onAutoplayEnabledChange: (enabled: boolean) => void;
}> = ({
  settings,
  onChange,
  rotationOffsets,
  onRotationOffsetsChange,
  liveRotationPreview,
  onHide,
  overlayLayoutSettings,
  onOverlayLayoutSettingsChange,
  overlayPositionEditEnabled,
  onOverlayPositionEditEnabledChange,
  cameraEnabled,
  onCameraEnabledChange,
  cameraBackdropEnabled,
  onCameraBackdropEnabledChange,
  cameraBackdropOpacity,
  onCameraBackdropOpacityChange,
  headFollowPositionEnabled,
  onHeadFollowPositionEnabledChange,
  headFollowPositionStrength,
  onHeadFollowPositionStrengthChange,
  headXAxisMapping,
  headYAxisMapping,
  onHeadXAxisMappingChange,
  onHeadYAxisMappingChange,
  isolateHeadXDebug,
  onIsolateHeadXDebugChange,
  isolateHeadYDebug,
  onIsolateHeadYDebugChange,
  rotationAxisDebugEnabled,
  onRotationAxisDebugEnabledChange,
  cameraDeviceId,
  onCameraDeviceIdChange,
  cameraOptions,
  flipX,
  onFlipXChange,
  flipY,
  onFlipYChange,
  listenerMode,
  onListenerModeChange,
  isBroadcaster,
  activeBroadcasterId,
  syncWarning,
  remotePointerControlEnabled,
  onRemotePointerControlEnabledChange,
  isFullscreen,
  onFullscreenToggle,
  autoplayEnabled,
  onAutoplayEnabledChange,
}) => {
  const getLiveRotationValue = (
    id: "yaw" | "xRotation" | "zRotation",
    baseValue: number,
  ) => {
    if (!liveRotationPreview) {
      return null;
    }

    if (id === "yaw") {
      return baseValue + liveRotationPreview.yaw;
    }
    if (id === "xRotation") {
      return baseValue + liveRotationPreview.xRotation;
    }
    return baseValue + liveRotationPreview.zRotation;
  };

  return (
    <div className="fixed bottom-4 left-4 top-4 z-[11000] w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-black/70 text-xs text-white backdrop-blur-md">
      <div
        className="h-full space-y-3 overflow-y-auto p-4 pr-3"
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          touchAction: "pan-y",
        }}
      >
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="font-semibold uppercase tracking-[0.2em] text-white/75">
              Orb Controller
            </p>
            <button
              aria-label="Hide orb controller"
              className="rounded-md border border-white/25 px-2 py-1 text-[11px] font-semibold text-white/90 transition hover:bg-white hover:text-black"
              onClick={onHide}
              type="button"
            >
              ◀
            </button>
          </div>
          <p className="mt-1 text-white/60">
            Move the mouse to steer the orb across X/Y. Rotation is smoothed for
            a softer, gliding feel. Press C to hide/show this panel. Press H to
            hide/show this panel and overlays together.
          </p>
        </div>
        <div className="space-y-2 rounded-lg border border-white/15 bg-white/5 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
            Display
          </p>
          <button
            className="w-full rounded-md border border-white/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-black"
            onClick={onFullscreenToggle}
            type="button"
          >
            {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          </button>
        </div>
        <div className="space-y-2 rounded-lg border border-white/15 bg-white/5 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
            Sync Role
          </p>
          <button
            className="w-full rounded-md border border-white/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-black"
            onClick={() => onListenerModeChange(!listenerMode)}
            type="button"
          >
            {listenerMode ? "Switch to Broadcaster" : "Switch to Listener"}
          </button>
          <p className="text-[11px] text-white/75">
            Role: {listenerMode ? "Listener" : "Broadcaster"}
          </p>
          {!listenerMode && (
            <p className="text-[11px] text-white/60">
              Broadcast status: {isBroadcaster ? "Active" : "Waiting"}
            </p>
          )}
          {listenerMode && (
            <p className="text-[11px] text-white/60">
              Broadcaster: {activeBroadcasterId ?? "Not found"}
            </p>
          )}
          {syncWarning && (
            <p className="text-[11px] font-medium text-[#ffaeae]">{syncWarning}</p>
          )}
          <label className="flex items-center gap-2 text-[11px] text-white/75">
            <input
              checked={remotePointerControlEnabled}
              onChange={(event) =>
                onRemotePointerControlEnabledChange(event.target.checked)
              }
              type="checkbox"
            />
            Enable mouse rotation override
          </label>
        </div>
        <div className="space-y-2 rounded-lg border border-white/15 bg-white/5 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
            Orb Autoplay
          </p>
          <button
            className="w-full rounded-md border border-white/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-black"
            onClick={() => onAutoplayEnabledChange(!autoplayEnabled)}
            type="button"
          >
            {autoplayEnabled ? "Pause Autoplay" : "Resume Autoplay"}
          </button>
          <p className="text-[11px] text-white/75">
            Status: {autoplayEnabled ? "On" : "Off"}
          </p>
          <p className="text-[11px] text-white/55">
            Auto-steps from 1 to 30 in orb modes unless map navigation turns it off.
          </p>
        </div>
        {orbControlRanges.map(({ id, label, min, max, step }) => (
          <label className="block" key={id}>
            {(() => {
              const isRotationControl =
                id === "yaw" || id === "xRotation" || id === "zRotation";
              const baseValue = settings[id];
              const liveValue = isRotationControl
                ? getLiveRotationValue(id, baseValue)
                : null;
              const clampedLiveValue =
                liveValue === null
                  ? null
                  : Math.min(Math.max(liveValue, min), max);

              return (
                <>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span>{label}</span>
                    <span className="font-mono text-[11px] text-white/70">
                      {liveValue === null
                        ? baseValue.toFixed(2)
                        : `${baseValue.toFixed(2)} → ${liveValue.toFixed(2)}`}
                    </span>
                  </div>
                  <input
                    className="w-full accent-white"
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={baseValue}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        [id]: parseFloat(event.target.value),
                      }))
                    }
                  />
                  {clampedLiveValue !== null && (
                    <input
                      className="mt-1 w-full accent-cyan-300"
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={clampedLiveValue}
                      disabled
                      aria-label={`Live ${label}`}
                    />
                  )}
                </>
              );
            })()}
          </label>
        ))}
        <div className="space-y-2 rounded-lg border border-white/15 bg-white/5 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
            Rotation Offsets
          </p>
          {[
            { id: "y" as const, label: "Y Offset", min: -Math.PI * 2, max: Math.PI * 2 },
            { id: "x" as const, label: "X Offset", min: -Math.PI, max: Math.PI },
            { id: "z" as const, label: "Z Offset", min: -Math.PI * 2, max: Math.PI * 2 },
          ].map(({ id, label, min, max }) => (
            <label className="block" key={id}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span>{label}</span>
                <span className="font-mono text-[11px] text-white/70">
                  {rotationOffsets[id].toFixed(2)}
                </span>
              </div>
              <input
                className="w-full accent-white"
                type="range"
                min={min}
                max={max}
                step={0.01}
                value={rotationOffsets[id]}
                onChange={(event) =>
                  onRotationOffsetsChange((current) => ({
                    ...current,
                    [id]: parseFloat(event.target.value),
                  }))
                }
              />
            </label>
          ))}
        </div>
        <div className="space-y-2 rounded-lg border border-white/15 bg-white/5 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
            Overlay Position
          </p>
          <button
            className="w-full rounded-md border border-white/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-black"
            onClick={() =>
              onOverlayPositionEditEnabledChange((current) => !current)
            }
            type="button"
          >
            {overlayPositionEditEnabled
              ? "Lock Overlay Position"
              : "Edit Overlay Position"}
          </button>
          <p className="text-[11px] text-white/65">
            Drag map/transcript on touch devices when edit mode is enabled.
          </p>
          {[
            {
              id: "mapRight" as const,
              label: "Map Right",
              min: -60,
              max: 520,
              step: 1,
            },
            {
              id: "mapVertical" as const,
              label: "Map Vertical",
              min: -320,
              max: 320,
              step: 1,
            },
            {
              id: "transcriptRight" as const,
              label: "Transcript Right",
              min: -35,
              max: 520,
              step: 1,
            },
            {
              id: "transcriptVertical" as const,
              label: "Transcript Vertical",
              min: -320,
              max: 320,
              step: 1,
            },
            {
              id: "transcriptCenterOffset" as const,
              label: "Transcript X Offset",
              min: -30,
              max: 420,
              step: 1,
            },
          ].map(({ id, label, min, max, step }) => (
            <label className="block" key={id}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span>{label}</span>
                <span className="font-mono text-[11px] text-white/70">
                  {Math.round(overlayLayoutSettings[id])}px
                </span>
              </div>
              <input
                className="w-full accent-white"
                type="range"
                min={min}
                max={max}
                step={step}
                value={overlayLayoutSettings[id]}
                onChange={(event) =>
                  onOverlayLayoutSettingsChange((current) => ({
                    ...current,
                    [id]: parseFloat(event.target.value),
                  }))
                }
              />
            </label>
          ))}
        </div>
        <div className="space-y-2 rounded-lg border border-white/15 bg-white/5 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
            Tracking Camera
          </p>
          <label className="flex items-center gap-2">
            <input
              checked={rotationAxisDebugEnabled}
              onChange={(event) =>
                onRotationAxisDebugEnabledChange(event.target.checked)
              }
              type="checkbox"
            />
            Show Rotation Axes
          </label>
          <p className="text-[11px] text-white/65">
            Axis colors: X red = pitch, Y green = yaw, Z blue = roll.
          </p>
          <button
            className="w-full rounded-md border border-white/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-black"
            onClick={() => onCameraEnabledChange((enabled) => !enabled)}
            type="button"
          >
            {cameraEnabled ? "Deactivate Camera" : "Activate Camera"}
          </button>
          <label className="block">
            <span className="mb-1 block text-[11px] text-white/75">Camera Source</span>
            <select
              className="w-full rounded-md border border-white/25 bg-black/60 px-2 py-1.5 text-white"
              onChange={(event) => onCameraDeviceIdChange(event.target.value)}
              value={cameraDeviceId}
            >
              {!cameraOptions.length && <option value="">No camera detected</option>}
              {cameraOptions.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                checked={flipX}
                onChange={(event) => onFlipXChange(event.target.checked)}
                type="checkbox"
              />
              Flip X
            </label>
            <label className="flex items-center gap-2">
              <input
                checked={flipY}
                onChange={(event) => onFlipYChange(event.target.checked)}
                type="checkbox"
              />
              Flip Y
            </label>
            <label className="flex items-center gap-2">
              <input
                checked={cameraBackdropEnabled}
                onChange={(event) =>
                  onCameraBackdropEnabledChange(event.target.checked)
                }
                type="checkbox"
              />
              Camera Feed Backdrop
            </label>
            <label className="flex items-center gap-2">
              <input
                checked={headFollowPositionEnabled}
                onChange={(event) =>
                  onHeadFollowPositionEnabledChange(event.target.checked)
                }
                type="checkbox"
              />
              Experimental Head-Move Sphere
            </label>
          </div>
          <label className="block">
            <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-white/75">
              <span>Backdrop Opacity</span>
              <span className="font-mono text-white/70">
                {Math.round(cameraBackdropOpacity * 100)}%
              </span>
            </div>
            <input
              className="w-full accent-white"
              disabled={!cameraBackdropEnabled}
              max={1}
              min={0}
              onChange={(event) =>
                onCameraBackdropOpacityChange(
                  Math.min(Math.max(parseFloat(event.target.value), 0), 1),
                )
              }
              step={0.01}
              type="range"
              value={cameraBackdropOpacity}
            />
          </label>
          <label className="block">
            <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-white/75">
              <span>Head Move Strength</span>
              <span className="font-mono text-white/70">
                {headFollowPositionStrength.toFixed(2)}
              </span>
            </div>
            <input
              className="w-full accent-white"
              disabled={!headFollowPositionEnabled}
              max={2.5}
              min={0.2}
              onChange={(event) =>
                onHeadFollowPositionStrengthChange(
                  Math.min(Math.max(parseFloat(event.target.value), 0.2), 2.5),
                )
              }
              step={0.01}
              type="range"
              value={headFollowPositionStrength}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-white/75">Head X Axis</span>
            <select
              className="w-full rounded-md border border-white/25 bg-black/60 px-2 py-1.5 text-white"
              onChange={(event) =>
                onHeadXAxisMappingChange(event.target.value as HeadXAxisMapping)
              }
              value={headXAxisMapping}
            >
              <option value="xRotation">X Rotation (Pitch)</option>
              <option value="yaw">Y Rotation (Yaw)</option>
              <option value="zRotation">Z Rotation (Roll)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-white/75">Head Y Axis</span>
            <select
              className="w-full rounded-md border border-white/25 bg-black/60 px-2 py-1.5 text-white"
              onChange={(event) =>
                onHeadYAxisMappingChange(event.target.value as HeadYAxisMapping)
              }
              value={headYAxisMapping}
            >
              <option value="zRotation">Z Rotation (Roll)</option>
              <option value="xRotation">X Rotation (Pitch)</option>
              <option value="yaw">Y Rotation (Yaw)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-[11px] text-white/80">
            <input
              checked={isolateHeadXDebug}
              onChange={(event) => onIsolateHeadXDebugChange(event.target.checked)}
              type="checkbox"
            />
            Isolate Head X (debug)
          </label>
          <label className="flex items-center gap-2 text-[11px] text-white/80">
            <input
              checked={isolateHeadYDebug}
              onChange={(event) => onIsolateHeadYDebugChange(event.target.checked)}
              type="checkbox"
            />
            Isolate Head Y (debug)
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            className="rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-black"
            onClick={() => {
              onChange(DEFAULT_GLASS_ORB_SETTINGS);
              onRotationOffsetsChange(DEFAULT_ROTATION_OFFSETS);
            }}
            type="button"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

const OrbSubtitle: React.FC<{
  projectId: ProjectId;
  currentModel: number;
}> = ({ projectId, currentModel }) => {
  const { currentLanguage } = useLanguageContext();
  const copy = CONFIG[projectId].text[currentModel];

  if (!copy) {
    return null;
  }

  return (
    <div className="fixed left-1/2 top-4 z-20 w-[min(88vw,680px)] -translate-x-1/2 rounded-full border border-white/15 bg-white/80 px-5 py-3 text-center text-sm font-semibold text-black shadow-lg shadow-black/15 backdrop-blur-sm">
      {currentLanguage ? copy[currentLanguage as TLanguage] : copy.en}
    </div>
  );
};

const ProjectScene: React.FC<{
  projectId: ProjectId;
  currentModel: number;
  moveProps: {
    projectId: ProjectId;
    currentModel: number;
    onMove: React.Dispatch<React.SetStateAction<number>>;
  };
  mediaUrls: string[];
  withSubtitle?: boolean;
  doubleBy?: number;
  scale?: [x: number, y: number, z: number];
  rotation?: [x: number, y: number, z: number];
  rotationOffsets: RotationOffsets;
  orbMode?: boolean;
  orb3DMode?: boolean;
  orbSettings: GlassOrbSettings;
  trackedSubjects: TrackedSubject[];
  cameraActive: boolean;
  headFollowPositionEnabled: boolean;
  headFollowPositionStrength: number;
  headXAxisMapping: HeadXAxisMapping;
  headYAxisMapping: HeadYAxisMapping;
  isolateHeadXDebug: boolean;
  isolateHeadYDebug: boolean;
  rotationAxisDebugEnabled: boolean;
  listenerMode: boolean;
  remotePointerControlEnabled: boolean;
  remoteOrbRotation: OrbRotationSnapshot | null;
  onOrbRotationChange?: (rotation: OrbRotationSnapshot) => void;
  useLocalAssetFallback?: boolean;
  mediaSessionKey: string;
  transcriptSyncKey: string;
}> = ({
  projectId,
  currentModel,
  moveProps,
  mediaUrls,
  withSubtitle,
  doubleBy,
  scale,
  rotation,
  rotationOffsets,
  orbMode,
  orb3DMode,
  orbSettings,
  trackedSubjects,
  cameraActive,
  headFollowPositionEnabled,
  headFollowPositionStrength,
  headXAxisMapping,
  headYAxisMapping,
  isolateHeadXDebug,
  isolateHeadYDebug,
  rotationAxisDebugEnabled,
  listenerMode,
  remotePointerControlEnabled,
  remoteOrbRotation,
  onOrbRotationChange,
  useLocalAssetFallback = false,
  mediaSessionKey,
  transcriptSyncKey,
}) => {
  const textureIndex = (doubleBy ? doubleBy + currentModel : currentModel) - 1;
  const activeMediaUrl =
    mediaUrls[Math.min(Math.max(textureIndex, 0), mediaUrls.length - 1)];
  const activeTexture = useActiveMediaTexture(
    activeMediaUrl,
    useLocalAssetFallback,
    mediaSessionKey,
    transcriptSyncKey,
  );
  const isOrbVisualMode = Boolean(orbMode || orb3DMode);
  const rotationOffset = rotation ?? [0, 0, 0];
  const effectiveOrbSettings = {
    ...orbSettings,
    yaw: orbSettings.yaw + rotationOffset[1] + rotationOffsets.y,
    xRotation: orbSettings.xRotation + rotationOffset[0] + rotationOffsets.x,
    zRotation: orbSettings.zRotation + rotationOffset[2] + rotationOffsets.z,
  };

  if (!activeTexture) {
    return null;
  }

  return (
    <>
      <ambientLight intensity={isOrbVisualMode ? 0.35 : 0.5} />
      <directionalLight
        intensity={isOrbVisualMode ? 1.9 : 0.75}
        position={isOrbVisualMode ? [6, 4, 8] : [5, 5, 5]}
      />
      {orb3DMode ? (
        <GlassOrb3DProjection
          texture={activeTexture}
          settings={effectiveOrbSettings}
          trackedSubjects={trackedSubjects}
          headFollowPositionEnabled={headFollowPositionEnabled}
          headFollowPositionStrength={headFollowPositionStrength}
          headXAxisMapping={headXAxisMapping}
          headYAxisMapping={headYAxisMapping}
          isolateHeadXDebug={isolateHeadXDebug}
          isolateHeadYDebug={isolateHeadYDebug}
          showRotationAxes={rotationAxisDebugEnabled}
          pointerControlEnabled={false}
          listenerMode={listenerMode}
          allowPointerControlInListenerMode={false}
          remoteRotation={remoteOrbRotation}
          onRotationChange={onOrbRotationChange}
        />
      ) : orbMode ? (
        <GlassOrbProjection
          texture={activeTexture}
          settings={effectiveOrbSettings}
          trackedSubjects={trackedSubjects}
          headFollowPositionEnabled={headFollowPositionEnabled}
          headFollowPositionStrength={headFollowPositionStrength}
          headXAxisMapping={headXAxisMapping}
          headYAxisMapping={headYAxisMapping}
          isolateHeadXDebug={isolateHeadXDebug}
          isolateHeadYDebug={isolateHeadYDebug}
          showRotationAxes={rotationAxisDebugEnabled}
          pointerControlEnabled={false}
          listenerMode={listenerMode}
          allowPointerControlInListenerMode={false}
          remoteRotation={remoteOrbRotation}
          onRotationChange={onOrbRotationChange}
        />
      ) : (
        <>
          <ModelEnv
            rotation={rotation ?? [0, -Math.PI / 2, 0]}
            texture={activeTexture}
            scale={scale ?? [1, 1, -1]}
          />
          {withSubtitle && CONFIG[projectId].text[currentModel] && (
            <SubtitleText>{CONFIG[projectId].text[currentModel]}</SubtitleText>
          )}
        </>
      )}
      {!isOrbVisualMode && (
        <>
          {/* Arrows to navigate */}
          {Object.keys(CONFIG[projectId].arrows).includes(
            currentModel.toString(),
          ) ? (
            CONFIG[projectId].arrows[currentModel].map(
              ([direction, value, tooltip], idx) => {
                return (
                  <Move
                    direction={direction}
                    value={value}
                    tooltip={tooltip}
                    {...moveProps}
                    key={idx}
                  />
                );
              },
            )
          ) : (
            <>
              <Move
                direction={"reverse"}
                value={-1}
                tooltip={null}
                {...moveProps}
              />
              <Move
                direction={"forward"}
                value={1}
                tooltip={null}
                {...moveProps}
              />
            </>
          )}
        </>
      )}
      {!isOrbVisualMode && <OrbitControls enabled={false} maxDistance={5} />}
    </>
  );
};

const ModelCanvas: React.FC<{
  projectId: ProjectId;
  imageId: string; // this imageId is provided from server. It is unused at the moment
  className?: string; // default: full screen
  withSubtitle?: boolean;
  column?: '1' | '2';
  doubleBy?: number; // two columns, specify the number of images to be skipped if the canvas is for the 2nd texture on the right column
  scale?: [x: number, y: number, z: number]
  rotation?: [x: number, y: number, z: number]
  filterStyle?: string;
}> = ({ projectId, imageId, className, withSubtitle, column, doubleBy, scale, rotation, filterStyle }) => {
  const pathname = usePathname();
  const router = useRouter();
  const isRestrictedUiAllowed = useRestrictedUiAccess();
  const currentIndexToPathname =
    pathname.split("/").length <= 2
      ? "1"
      : pathname.split("/")[pathname.split("/").length - 1];

  // State management to control the current model, this state is controlled by <Move /> as well
  const [currentModel, setCurrentModel] = useState<number>(
    doubleBy
      ? (doubleBy + parseInt(currentIndexToPathname)) % 44
      : parseInt(currentIndexToPathname),
  );
  const [orbSettings, setOrbSettings] = useState<GlassOrbSettings>(
    DEFAULT_GLASS_ORB_SETTINGS,
  );
  const [rotationOffsets, setRotationOffsets] = useState<RotationOffsets>(
    DEFAULT_ROTATION_OFFSETS,
  );
  const [showOrbControls, setShowOrbControls] = useState(false);
  const [trackedSubjects, setTrackedSubjects] = useState<TrackedSubject[]>([]);
  const [trackingCameraEnabled, setTrackingCameraEnabled] = useState(false);
  const [trackingCameraDeviceId, setTrackingCameraDeviceId] = useState("");
  const [trackingFlipX, setTrackingFlipX] = useState(true);
  const [trackingFlipY, setTrackingFlipY] = useState(false);
  const [trackingBackdropEnabled, setTrackingBackdropEnabled] = useState(true);
  const [trackingBackdropOpacity, setTrackingBackdropOpacity] = useState(0.66);
  const [headFollowPositionEnabled, setHeadFollowPositionEnabled] =
    useState(true);
  const [headFollowPositionStrength, setHeadFollowPositionStrength] =
    useState(1);
  const [headXAxisMapping, setHeadXAxisMapping] =
    useState<HeadXAxisMapping>("xRotation");
  const [headYAxisMapping, setHeadYAxisMapping] =
    useState<HeadYAxisMapping>("yaw");
  const [isolateHeadXDebug, setIsolateHeadXDebug] = useState(true);
  const [isolateHeadYDebug, setIsolateHeadYDebug] = useState(true);
  const [rotationAxisDebugEnabled, setRotationAxisDebugEnabled] =
    useState(false);
  const [hideOrbHud, setHideOrbHud] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [cameraOptions, setCameraOptions] = useState<CameraOption[]>([]);
  const [orbAutoplayEnabled, setOrbAutoplayEnabledState] = useState(true);
  const orbClientIdRef = useRef(
    `orb-${Math.random().toString(36).slice(2, 10)}`,
  );
  const [listenerMode, setListenerMode] = useState(false);
  const hasUserManuallySelectedRoleRef = useRef(false);
  const hasAppliedTouchOrbDefaultsRef = useRef(false);
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  const [activeBroadcasterId, setActiveBroadcasterId] = useState<string | null>(
    null,
  );
  const [remoteOrbRotation, setRemoteOrbRotation] =
    useState<OrbRotationSnapshot | null>(null);
  const [liveOrbRotationPreview, setLiveOrbRotationPreview] =
    useState<OrbRotationSnapshot | null>(null);
  const [activeVideoDurationMs, setActiveVideoDurationMs] = useState<
    number | null
  >(null);
  const [remotePointerControlEnabled, setRemotePointerControlEnabled] =
    useState(false);
  const [orbSyncError, setOrbSyncError] = useState<string | null>(null);
  const [orbRoleWarning, setOrbRoleWarning] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const activeTrackedSubjectRef = useRef<TrackedSubject | null>(null);
  const orbSocketRef = useRef<Socket | null>(null);
  const orbSocketConnectedRef = useRef(false);
  const listenerModeRef = useRef(listenerMode);
  const activeBroadcasterIdRef = useRef<string | null>(null);
  const lastOrbRotationSentAtRef = useRef(0);
  const lastOrbRotationPayloadRef = useRef<OrbRotationSnapshot | null>(null);
  const lastLiveRotationUiUpdateAtRef = useRef(0);
  const liveOrbRotationPreviewRef = useRef<OrbRotationSnapshot | null>(null);
  const useLocalAssetFallback = PROJECTS_WITH_LOCAL_ASSET_FALLBACK.has(
    projectId,
  );
  const [projectMediaPreloadReady, setProjectMediaPreloadReady] = useState(false);
  const [projectMediaPreloadLoaded, setProjectMediaPreloadLoaded] = useState(0);
  const hasSecondaryCanvas = typeof doubleBy === "number";
  const {
    overlayLayoutSettings,
    setOverlayLayoutSettings,
    overlayPositionEditEnabled,
    setOverlayPositionEditEnabled,
    isOrbMode,
    isOrb3DMode,
    isOrbLikeMode,
    showOrbUi,
    showEquirectUi,
    shouldHideSecondaryOrbCanvas,
  } = useModelCanvasModes({
    pathname,
    isRestrictedUiAllowed,
    hasSecondaryCanvas,
  });

  useEffect(() => {
    setCurrentModel(parseInt(currentIndexToPathname));
    setShowOrbControls(false);
  }, [currentIndexToPathname]);

  useEffect(() => {
    setRotationOffsets((current) => {
      const isLegacyDefault =
        Math.abs(current.x - 1.28) < 0.001 &&
        Math.abs(current.y - 1.6) < 0.001 &&
        Math.abs(current.z) < 0.001;
      return isLegacyDefault ? DEFAULT_ROTATION_OFFSETS : current;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setOrbAutoplayEnabledState(params.get("autoplay") !== "off");
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncTouchDevice = () => {
      const hasTouch =
        (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
        "ontouchstart" in window ||
        window.matchMedia?.("(pointer: coarse)").matches;
      setIsTouchDevice(hasTouch);
    };

    syncTouchDevice();
    window.addEventListener("resize", syncTouchDevice);

    return () => {
      window.removeEventListener("resize", syncTouchDevice);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") {
      return;
    }

    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitFullscreenElement?: Element | null;
    };
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    const fullscreenActive = Boolean(
      doc.fullscreenElement || doc.webkitFullscreenElement,
    );

    try {
      if (fullscreenActive) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
        return;
      }

      if (root.requestFullscreen) {
        await root.requestFullscreen();
      } else if (root.webkitRequestFullscreen) {
        await root.webkitRequestFullscreen();
      }
    } catch {
      // Ignore failed fullscreen requests from browser policy restrictions.
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const syncFullscreen = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      setIsFullscreen(
        Boolean(doc.fullscreenElement || doc.webkitFullscreenElement),
      );
    };

    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener(
      "webkitfullscreenchange",
      syncFullscreen as EventListener,
    );

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener(
        "webkitfullscreenchange",
        syncFullscreen as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleFullscreenHotkey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTypingTarget || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key.toLowerCase() !== "f") {
        return;
      }

      event.preventDefault();
      void handleToggleFullscreen();
    };

    window.addEventListener("keydown", handleFullscreenHotkey);
    return () => {
      window.removeEventListener("keydown", handleFullscreenHotkey);
    };
  }, [handleToggleFullscreen]);

  const moveProps = {
    projectId: projectId,
    currentModel: currentModel,
    onMove: setCurrentModel,
  };

  const mediaUrls = useMemo(
    () =>
      Array(CONFIG[projectId].numberOfImages)
        .fill(null)
        .map((_, idx) => getMediaPath(projectId, idx + 1)),
    [projectId],
  );
  const mediaSessionKey = useMemo(
    () => `${projectId}:${column ?? "single"}:${doubleBy ?? "primary"}`,
    [column, doubleBy, projectId],
  );
  const transcriptSyncKey = useMemo(
    () => `${projectId}:${currentModel}`,
    [currentModel, projectId],
  );
  const textureIndex = (doubleBy ? doubleBy + currentModel : currentModel) - 1;
  const activeMediaUrl =
    mediaUrls[Math.min(Math.max(textureIndex, 0), mediaUrls.length - 1)];
  const prioritizedPreload = useMemo(
    () => getPrioritizedPreloadIndices(textureIndex, mediaUrls.length),
    [mediaUrls.length, textureIndex],
  );

  useEffect(() => {
    if (shouldHideSecondaryOrbCanvas) {
      return;
    }

    if (preloadedProjects.has(projectId)) {
      setProjectMediaPreloadLoaded(mediaUrls.length);
      setProjectMediaPreloadReady(true);
      return;
    }

    let disposed = false;
    const controller = new AbortController();
    const blockingPriorityCount = Math.min(
      PROJECT_MEDIA_BLOCKING_PRIORITY_COUNT,
      prioritizedPreload.priorityCount,
    );
    const priorityIndexSet = new Set(
      prioritizedPreload.orderedIndices.slice(0, blockingPriorityCount),
    );
    let loadedPriorityCount = 0;

    setProjectMediaPreloadReady(false);
    setProjectMediaPreloadLoaded(0);

    if (blockingPriorityCount === 0) {
      setProjectMediaPreloadReady(true);
    }

    let nextIndex = 0;
    const worker = async () => {
      while (!disposed && !controller.signal.aborted) {
        const preloadOrderIndex = nextIndex;
        nextIndex += 1;
        if (preloadOrderIndex >= prioritizedPreload.orderedIndices.length) {
          break;
        }

        const mediaIndex = prioritizedPreload.orderedIndices[preloadOrderIndex];
        await preloadSceneMedia(
          mediaUrls[mediaIndex],
          useLocalAssetFallback,
          controller.signal,
        );

        if (!disposed) {
          if (priorityIndexSet.has(mediaIndex)) {
            loadedPriorityCount += 1;
            if (loadedPriorityCount >= blockingPriorityCount) {
              setProjectMediaPreloadReady(true);
            }
          }
          setProjectMediaPreloadLoaded((count) => count + 1);
        }
      }
    };

    const preloadConcurrency = isTouchDevice
      ? PROJECT_MEDIA_PRELOAD_CONCURRENCY_TOUCH
      : PROJECT_MEDIA_PRELOAD_CONCURRENCY_DESKTOP;
    const workers = Array.from(
      { length: Math.min(preloadConcurrency, mediaUrls.length) },
      () => worker(),
    );

    void Promise.allSettled(workers).then(() => {
      if (!disposed) {
        preloadedProjects.add(projectId);
        setProjectMediaPreloadReady(true);
      }
    });

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [
    mediaUrls,
    prioritizedPreload,
    projectId,
    shouldHideSecondaryOrbCanvas,
    isTouchDevice,
    useLocalAssetFallback,
  ]);

  // Two Columns Style
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsSmallScreen(window.innerWidth < 425);
      const handleResize = () => setIsSmallScreen(window.innerWidth < 425);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !showOrbUi ||
      !isOrbLikeMode ||
      !isVideoMediaUrl(activeMediaUrl)
    ) {
      setActiveVideoDurationMs(null);
      return;
    }

    let disposed = false;
    const video = document.createElement("video");
    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");

    const fallbackMediaUrl = useLocalAssetFallback
      ? getLocalAssetFallbackPath(activeMediaUrl)
      : null;
    const candidateSources = [activeMediaUrl, fallbackMediaUrl]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .filter((value, index, all) => all.indexOf(value) === index);

    let sourceIndex = 0;
    let timeoutId: number | null = null;

    const cleanup = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
      video.pause();
      video.src = "";
      video.load();
    };

    const finalizeWithFallback = () => {
      if (disposed) {
        return;
      }
      setActiveVideoDurationMs(ORB_AUTOPLAY_VIDEO_FALLBACK_MS);
    };

    const handleLoadedMetadata = () => {
      if (disposed) {
        return;
      }

      const durationSeconds = Number(video.duration);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        finalizeWithFallback();
        return;
      }

      setActiveVideoDurationMs(Math.ceil(durationSeconds * 1000));
    };

    const loadCandidateSource = (source: string) => {
      video.src = source;
      video.load();
    };

    const handleError = () => {
      if (disposed) {
        return;
      }

      sourceIndex += 1;
      if (sourceIndex >= candidateSources.length) {
        finalizeWithFallback();
        return;
      }

      loadCandidateSource(candidateSources[sourceIndex]);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("error", handleError);

    if (!candidateSources.length) {
      finalizeWithFallback();
      return () => {
        disposed = true;
        cleanup();
      };
    }

    timeoutId = window.setTimeout(() => {
      finalizeWithFallback();
    }, 8000);

    loadCandidateSource(candidateSources[sourceIndex]);

    return () => {
      disposed = true;
      cleanup();
    };
  }, [activeMediaUrl, isOrbLikeMode, showOrbUi, useLocalAssetFallback]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      return;
    }

    let disposed = false;

    const syncCameraOptions = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();

        if (disposed) {
          return;
        }

        const nextCameraOptions = devices
          .filter((device) => device.kind === "videoinput")
          .map((device, index) => ({
            id: device.deviceId,
            label: device.label || `Camera ${index + 1}`,
          }));

        setCameraOptions(nextCameraOptions);
        setTrackingCameraDeviceId((current) => {
          if (!nextCameraOptions.length) {
            return "";
          }

          if (
            current &&
            nextCameraOptions.some((camera) => camera.id === current)
          ) {
            return current;
          }

          return nextCameraOptions[0].id;
        });
      } catch {
        // Ignore camera enumeration failures.
      }
    };

    syncCameraOptions();

    const mediaDevices = navigator.mediaDevices;
    mediaDevices.addEventListener?.("devicechange", syncCameraOptions);

    return () => {
      disposed = true;
      mediaDevices.removeEventListener?.("devicechange", syncCameraOptions);
    };
  }, []);

  const style: Record<string, React.CSSProperties> = {
    "1": {
        position: "fixed",
        width: isSmallScreen ? "100vw" : "50vw",
        height: isSmallScreen ? "50vh" : "100vh",
        top: 0,
        left: isSmallScreen ? 0 : '50vw',
        filter: filterStyle
    },
  "2": {
        position: "fixed",
        width: isSmallScreen ? "100vw" : "50vw",
        height: isSmallScreen ? "50vh" : "100vh",
        top: isSmallScreen ? "50vh" : 0,
        left: 0,
        filter: filterStyle
    }
  }

  const maxOrbAutoplayIndex = Math.min(
    ORB_AUTOPLAY_END_INDEX,
    CONFIG[projectId].numberOfImages,
  );

  const setOrbAutoplayEnabled = useCallback(
    (enabled: boolean) => {
      setOrbAutoplayEnabledState(enabled);

      if (typeof window === "undefined") {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      if (enabled) {
        params.delete("autoplay");
      } else {
        params.set("autoplay", "off");
      }

      const query = params.toString();
      router.replace(
        `/${projectId}/${currentModel.toString()}${query ? `?${query}` : ""}`,
        { scroll: false },
      );
    },
    [currentModel, projectId, router],
  );

  useEffect(() => {
    if (!showOrbUi || !isOrbLikeMode || !orbAutoplayEnabled) {
      return;
    }

    const isVideoAutoplayStep = isVideoMediaUrl(activeMediaUrl);
    const autoplayDelayMs = isVideoAutoplayStep
      ? Math.max(activeVideoDurationMs ?? ORB_AUTOPLAY_VIDEO_FALLBACK_MS, 400)
      : ORB_AUTOPLAY_INTERVAL_MS;

    const timeoutId = window.setTimeout(() => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("autoplay") === "off") {
          setOrbAutoplayEnabledState(false);
          return;
        }
      }

      const nextModel =
        currentModel >= maxOrbAutoplayIndex || currentModel < ORB_AUTOPLAY_START_INDEX
          ? ORB_AUTOPLAY_START_INDEX
          : currentModel + 1;

      setCurrentModel(nextModel);

      if (typeof window === "undefined") {
        return;
      }

      const query = window.location.search ?? "";
      router.replace(`/${projectId}/${nextModel.toString()}${query}`, {
        scroll: false,
      });
    }, autoplayDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeMediaUrl,
    activeVideoDurationMs,
    currentModel,
    isOrbLikeMode,
    maxOrbAutoplayIndex,
    orbAutoplayEnabled,
    projectId,
    router,
    showOrbUi,
  ]);

  const activeTrackedSubject = useMemo(
    () =>
      trackedSubjects.reduce<TrackedSubject | null>((best, subject) => {
        if (!best) {
          return subject;
        }

        if (subject.confidence === best.confidence) {
          return subject.lastUpdated > best.lastUpdated ? subject : best;
        }

        return subject.confidence > best.confidence ? subject : best;
      }, null),
    [trackedSubjects],
  );

  useEffect(() => {
    activeTrackedSubjectRef.current = activeTrackedSubject;
  }, [activeTrackedSubject]);

  const handleListenerModeChange = useCallback((enabled: boolean) => {
    hasUserManuallySelectedRoleRef.current = true;
    setListenerMode(enabled);
    setOrbRoleWarning(null);
    setOrbSyncError(null);
    if (enabled) {
      setIsBroadcaster(false);
    }
  }, []);

  useEffect(() => {
    if (!showOrbUi || !isOrbLikeMode || hasUserManuallySelectedRoleRef.current) {
      return;
    }

    setListenerMode(isTouchDevice);
  }, [isOrbLikeMode, isTouchDevice, showOrbUi]);

  useEffect(() => {
    if (!isTouchDevice || hasAppliedTouchOrbDefaultsRef.current) {
      return;
    }

    hasAppliedTouchOrbDefaultsRef.current = true;
    setOrbSettings((current) => ({
      ...current,
      radius: 3,
      xRotation: 0.6,
      yaw: 6.2,
    }));
  }, [isTouchDevice]);

  useEffect(() => {
    listenerModeRef.current = listenerMode;
  }, [listenerMode]);

  useEffect(() => {
    activeBroadcasterIdRef.current = activeBroadcasterId;
  }, [activeBroadcasterId]);

  const handleOrbRotationChange = useCallback(
    (rotation: OrbRotationSnapshot) => {
      const now = Date.now();
      const previousLiveRotation = liveOrbRotationPreviewRef.current;
      if (
        !previousLiveRotation ||
        Math.abs(previousLiveRotation.yaw - rotation.yaw) > 0.01 ||
        Math.abs(previousLiveRotation.xRotation - rotation.xRotation) > 0.01 ||
        Math.abs(previousLiveRotation.zRotation - rotation.zRotation) > 0.01 ||
        now - lastLiveRotationUiUpdateAtRef.current > 80
      ) {
        liveOrbRotationPreviewRef.current = rotation;
        lastLiveRotationUiUpdateAtRef.current = now;
        setLiveOrbRotationPreview(rotation);
      }

      if (
        typeof window === "undefined" ||
        !showOrbUi ||
        !isOrbLikeMode ||
        listenerMode ||
        !isBroadcaster
      ) {
        return;
      }

      if (now - lastOrbRotationSentAtRef.current < ORB_SYNC_ROTATION_SEND_INTERVAL_MS) {
        return;
      }

      const previousRotation = lastOrbRotationPayloadRef.current;
      if (
        previousRotation &&
        Math.abs(previousRotation.yaw - rotation.yaw) < 0.001 &&
        Math.abs(previousRotation.xRotation - rotation.xRotation) < 0.001 &&
        Math.abs(previousRotation.zRotation - rotation.zRotation) < 0.001
      ) {
        return;
      }

      lastOrbRotationSentAtRef.current = now;
      lastOrbRotationPayloadRef.current = rotation;

      if (orbSocketConnectedRef.current && orbSocketRef.current) {
        orbSocketRef.current.emit("orb:rotation", {
          clientId: orbClientIdRef.current,
          yaw: rotation.yaw,
          xRotation: rotation.xRotation,
          zRotation: rotation.zRotation,
        });
        setOrbSyncError(null);
        return;
      }

      void fetch("/api/orb-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          action: "rotation",
          clientId: orbClientIdRef.current,
          yaw: rotation.yaw,
          xRotation: rotation.xRotation,
          zRotation: rotation.zRotation,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed rotation sync action.");
          }
          setOrbSyncError(null);
        })
        .catch(() => {
          setOrbSyncError("Sync server unavailable.");
        });
    },
    [isBroadcaster, isOrbLikeMode, listenerMode, showOrbUi],
  );

  useEffect(() => {
    if (showOrbUi && isOrbLikeMode) {
      return;
    }

    liveOrbRotationPreviewRef.current = null;
    setLiveOrbRotationPreview(null);
  }, [isOrbLikeMode, showOrbUi]);

  useEffect(() => {
    if (typeof window === "undefined" || !showOrbUi || !isOrbLikeMode) {
      orbSocketConnectedRef.current = false;
      orbSocketRef.current?.disconnect();
      orbSocketRef.current = null;
      return;
    }

    let disposed = false;
    let socket: Socket | null = null;

    const connectSocket = async () => {
      try {
        await fetch("/api/orb-ws", { cache: "no-store" });
      } catch {
        // Ignore bootstrap failures and still attempt socket connection.
      }

      if (disposed) {
        return;
      }

      socket = io({
        path: "/api/orb-ws/socket.io",
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 250,
        reconnectionDelayMax: 1500,
      });
      orbSocketRef.current = socket;

      socket.on("connect", () => {
        orbSocketConnectedRef.current = true;
        setOrbSyncError(null);
      });

      socket.on("disconnect", () => {
        orbSocketConnectedRef.current = false;
      });

      socket.on("connect_error", () => {
        orbSocketConnectedRef.current = false;
      });

      socket.on("orb:rotation", (payload: unknown) => {
        if (!listenerModeRef.current) {
          return;
        }

        if (!payload || typeof payload !== "object") {
          return;
        }

        const parsed = payload as {
          clientId?: unknown;
          yaw?: unknown;
          xRotation?: unknown;
          zRotation?: unknown;
        };
        const clientId =
          typeof parsed.clientId === "string" ? parsed.clientId : null;
        const yaw = typeof parsed.yaw === "number" ? parsed.yaw : null;
        const xRotation =
          typeof parsed.xRotation === "number" ? parsed.xRotation : null;
        const zRotation =
          typeof parsed.zRotation === "number" ? parsed.zRotation : 0;

        if (
          !clientId ||
          !Number.isFinite(yaw) ||
          !Number.isFinite(xRotation)
        ) {
          return;
        }

        const activeBroadcaster = activeBroadcasterIdRef.current;
        if (activeBroadcaster && activeBroadcaster !== clientId) {
          return;
        }

        setRemoteOrbRotation({
          yaw,
          xRotation,
          zRotation,
        });
      });
    };

    void connectSocket();

    return () => {
      disposed = true;
      orbSocketConnectedRef.current = false;
      orbSocketRef.current?.disconnect();
      orbSocketRef.current = null;
      socket = null;
    };
  }, [isOrbLikeMode, showOrbUi]);

  useEffect(() => {
    if (typeof window === "undefined" || !showOrbUi || !isOrbLikeMode) {
      return;
    }

    let disposed = false;

    const pollSyncSnapshot = async () => {
      try {
        const response = await fetch("/api/orb-sync", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Failed to fetch orb sync snapshot.");
        }

        const payload = (await response.json()) as {
          broadcasterId?: string | null;
          rotation?: { yaw?: number; xRotation?: number; zRotation?: number } | null;
        };

        if (disposed) {
          return;
        }

        const broadcasterId =
          typeof payload.broadcasterId === "string"
            ? payload.broadcasterId
            : null;
        const isSelfBroadcaster = broadcasterId === orbClientIdRef.current;
        const shouldUseRemoteRotation = listenerMode || isSelfBroadcaster;

        setActiveBroadcasterId(broadcasterId);
        setIsBroadcaster((current) => {
          if (isSelfBroadcaster) {
            return true;
          }
          if (broadcasterId && broadcasterId !== orbClientIdRef.current) {
            return false;
          }
          return listenerMode ? false : current;
        });

        if (shouldUseRemoteRotation) {
          if (listenerMode && orbSocketConnectedRef.current) {
            setOrbSyncError(null);
            return;
          }

          const yaw = payload.rotation?.yaw;
          const xRotation = payload.rotation?.xRotation;
          const zRotation =
            typeof payload.rotation?.zRotation === "number"
              ? payload.rotation.zRotation
              : 0;
          if (
            Number.isFinite(yaw) &&
            Number.isFinite(xRotation)
          ) {
            setRemoteOrbRotation({
              yaw: yaw as number,
              xRotation: xRotation as number,
              zRotation,
            });
          } else if (!listenerMode) {
            setRemoteOrbRotation(null);
          }
        } else {
          setRemoteOrbRotation(null);
        }

        setOrbSyncError(null);
      } catch {
        if (disposed) {
          return;
        }

        setOrbSyncError("Sync server unavailable.");
        setRemoteOrbRotation(null);
      }
    };

    void pollSyncSnapshot();
    const intervalId = window.setInterval(() => {
      void pollSyncSnapshot();
    }, ORB_SYNC_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [isOrbLikeMode, listenerMode, showOrbUi]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !showOrbUi ||
      !isOrbLikeMode ||
      listenerMode
    ) {
      setIsBroadcaster(false);
      return;
    }

    let disposed = false;
    const clientId = orbClientIdRef.current;

    const postOrbSyncAction = async (
      action: "claim" | "heartbeat" | "release",
    ) => {
      const response = await fetch("/api/orb-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          action,
          clientId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed orb sync action.");
      }

      return response.json();
    };

    const claimBroadcaster = async () => {
      try {
        const payload = (await postOrbSyncAction("claim")) as {
          ok?: boolean;
          broadcasterId?: string | null;
        };

        if (disposed) {
          return;
        }

        const broadcasterId =
          typeof payload.broadcasterId === "string"
            ? payload.broadcasterId
            : null;
        setActiveBroadcasterId(broadcasterId);

        if (payload.ok) {
          setIsBroadcaster(true);
          setOrbRoleWarning(null);
        } else {
          setIsBroadcaster(false);
          setOrbRoleWarning(
            "Another broadcaster is active. Switch to listener or try again later.",
          );
        }

        setOrbSyncError(null);
      } catch {
        if (disposed) {
          return;
        }

        setIsBroadcaster(false);
        setOrbSyncError("Sync server unavailable.");
      }
    };

    void claimBroadcaster();

    const heartbeatId = window.setInterval(() => {
      void postOrbSyncAction("heartbeat")
        .then((payload) => {
          if (disposed) {
            return;
          }

          const heartbeatPayload = payload as {
            ok?: boolean;
            broadcasterId?: string | null;
          };
          const broadcasterId =
            typeof heartbeatPayload.broadcasterId === "string"
              ? heartbeatPayload.broadcasterId
              : null;
          setActiveBroadcasterId(broadcasterId);

          if (heartbeatPayload.ok) {
            setIsBroadcaster(true);
            setOrbRoleWarning(null);
          } else {
            setIsBroadcaster(false);
            if (broadcasterId && broadcasterId !== clientId) {
              setOrbRoleWarning(
                "Another broadcaster is active. Switch to listener or try again later.",
              );
            } else {
              setOrbRoleWarning("Broadcaster claim lost. Reclaiming...");
              void claimBroadcaster();
            }
          }

          setOrbSyncError(null);
        })
        .catch(() => {
          if (!disposed) {
            setOrbSyncError("Sync server unavailable.");
          }
        });
    }, ORB_SYNC_HEARTBEAT_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(heartbeatId);
      void postOrbSyncAction("release").catch(() => {});
    };
  }, [isOrbLikeMode, listenerMode, showOrbUi]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !showOrbUi ||
      !isOrbLikeMode ||
      listenerMode ||
      !isBroadcaster ||
      !trackingCameraEnabled
    ) {
      return;
    }

    let disposed = false;
    const clientId = orbClientIdRef.current;

    const sendCameraData = async () => {
      const subject = activeTrackedSubjectRef.current;
      if (!subject) {
        return;
      }

      try {
        await fetch("/api/orb-sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            action: "camera",
            clientId,
            x: subject.x,
            y: subject.y,
            confidence: subject.confidence,
          }),
        });

        if (!disposed) {
          setOrbSyncError(null);
        }
      } catch {
        if (!disposed) {
          setOrbSyncError("Sync server unavailable.");
        }
      }
    };

    void sendCameraData();
    const intervalId = window.setInterval(() => {
      void sendCameraData();
    }, ORB_SYNC_CAMERA_SEND_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [
    isBroadcaster,
    isOrbLikeMode,
    listenerMode,
    showOrbUi,
    trackingCameraEnabled,
  ]);

  const currentMoves: DirectionTuple[] = Object.keys(CONFIG[projectId].arrows).includes(
    currentModel.toString(),
  )
    ? CONFIG[projectId].arrows[currentModel]
    : [
        ["reverse", -1, null],
        ["forward", 1, null],
      ];

  const handleEquirectMove = (value: number) => {
    const nextModel = Math.min(
      Math.max(currentModel + value, 1),
      CONFIG[projectId].numberOfImages,
    );

    if (nextModel === currentModel) {
      return;
    }

    setCurrentModel(nextModel);

    if (typeof window === "undefined") {
      return;
    }

    const search = window.location.search ?? "";
    router.push(`/${projectId}/${nextModel.toString()}${search}`, {
      scroll: false,
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOrbControlsToggle = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (
        !isOrbLikeMode ||
        isTypingTarget ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      if (event.key.toLowerCase() !== "c") {
        return;
      }

      event.preventDefault();
      setShowOrbControls((visible) => !visible);
    };

    window.addEventListener("keydown", handleOrbControlsToggle);
    return () => {
      window.removeEventListener("keydown", handleOrbControlsToggle);
    };
  }, [isOrbLikeMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOrbHudToggle = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (
        !isOrbLikeMode ||
        isTypingTarget ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      if (event.key.toLowerCase() !== "h") {
        return;
      }

      event.preventDefault();
      setHideOrbHud((current) => !current);
    };

    window.addEventListener("keydown", handleOrbHudToggle);
    return () => {
      window.removeEventListener("keydown", handleOrbHudToggle);
    };
  }, [isOrbLikeMode]);

  if (shouldHideSecondaryOrbCanvas) {
    return null;
  }

  if (!projectMediaPreloadReady) {
    const progressPercent = mediaUrls.length
      ? Math.round((projectMediaPreloadLoaded / mediaUrls.length) * 100)
      : 100;

    return (
      <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black">
        <div className="w-[300px] rounded-xl border border-white/15 bg-white/90 p-4 text-black shadow-xl">
          <div className="text-center text-xs font-semibold tracking-[0.12em]">
            Loading...
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded bg-black/15">
            <div
              className="h-full bg-black transition-[width] duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 text-center text-xs text-black/70">
            {projectMediaPreloadLoaded}/{mediaUrls.length} images
          </div>
        </div>
      </div>
    );
  }

  if (showEquirectUi) {
    return (
      <>
        <EquirectangularView
          mediaUrl={activeMediaUrl}
          isVideo={isVideoMediaUrl(activeMediaUrl)}
          useLocalAssetFallback={useLocalAssetFallback}
          currentMoves={currentMoves}
          onMove={handleEquirectMove}
        />
        {withSubtitle && (
          <OrbSubtitle projectId={projectId} currentModel={currentModel} />
        )}
      </>
    );
  }

  return (
    <>
      {isOrbLikeMode && <div className="fixed inset-0 z-0 bg-black" />}
      <Canvas
        className={className}
        orthographic={isOrbLikeMode}
        style={{
          ...(isOrbLikeMode
            ? {
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 10,
                filter: filterStyle,
                backgroundColor: "transparent",
              }
            : column
              ? style[column]
              : { filter: filterStyle }),
          ...(isTouchDevice
            ? {
                transform: "rotate(180deg)",
                transformOrigin: "center center",
              }
            : {}),
        }}
        gl={{
          toneMappingExposure: isOrbLikeMode
            ? ORB_TONE_MAPPING_EXPOSURE
            : SPHERE_TONE_MAPPING_EXPOSURE,
          alpha: isOrbLikeMode,
        }}
        camera={
          isOrbLikeMode
            ? {
                position: [0, 0, 12],
                zoom: isOrb3DMode ? 74 : 118,
                near: 0.1,
                far: 1000,
              }
            : undefined
        }
      >
        <Suspense fallback={<ModelLoader />}>
          <ProjectScene
            projectId={projectId}
            currentModel={currentModel}
            moveProps={moveProps}
            mediaUrls={mediaUrls}
            withSubtitle={withSubtitle}
            doubleBy={doubleBy}
            scale={scale}
            rotation={rotation}
            rotationOffsets={rotationOffsets}
            orbMode={isOrbMode}
            orb3DMode={isOrb3DMode}
            orbSettings={orbSettings}
            trackedSubjects={trackedSubjects}
            cameraActive={trackingCameraEnabled}
            headFollowPositionEnabled={
              headFollowPositionEnabled && trackingCameraEnabled
            }
            headFollowPositionStrength={headFollowPositionStrength}
            headXAxisMapping={headXAxisMapping}
            headYAxisMapping={headYAxisMapping}
            isolateHeadXDebug={isolateHeadXDebug}
            isolateHeadYDebug={isolateHeadYDebug}
            rotationAxisDebugEnabled={rotationAxisDebugEnabled}
            listenerMode={listenerMode}
            remotePointerControlEnabled={remotePointerControlEnabled}
            remoteOrbRotation={listenerMode ? remoteOrbRotation : null}
            onOrbRotationChange={handleOrbRotationChange}
            useLocalAssetFallback={useLocalAssetFallback}
            mediaSessionKey={mediaSessionKey}
            transcriptSyncKey={transcriptSyncKey}
          />
        </Suspense>
      </Canvas>
      <SubjectPresence
        enabled={showOrbUi}
        cameraEnabled={trackingCameraEnabled}
        cameraDeviceId={trackingCameraDeviceId || undefined}
        flipX={trackingFlipX}
        flipY={trackingFlipY}
        debugEnabled={false}
        cameraBackdropEnabled={trackingBackdropEnabled && trackingCameraEnabled}
        cameraBackdropOpacity={trackingBackdropOpacity}
        onSubjectsChange={setTrackedSubjects}
      />
      {showOrbUi && withSubtitle && (
        <OrbSubtitle projectId={projectId} currentModel={currentModel} />
      )}
      {showOrbUi && !showOrbControls && (!hideOrbHud || isTouchDevice) && (
        <button
          aria-label="Show orb controller"
          className="fixed bottom-4 left-4 z-[11000] rounded-r-xl border border-white/20 bg-black/70 px-3 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white hover:text-black"
          onClick={() => setShowOrbControls(true)}
          type="button"
        >
          ▶
        </button>
      )}
      {showOrbUi && showOrbControls && (!hideOrbHud || isTouchDevice) && (
        <OrbControls
          settings={orbSettings}
          onChange={setOrbSettings}
          rotationOffsets={rotationOffsets}
          onRotationOffsetsChange={setRotationOffsets}
          liveRotationPreview={liveOrbRotationPreview}
          onHide={() => setShowOrbControls(false)}
          overlayLayoutSettings={overlayLayoutSettings}
          onOverlayLayoutSettingsChange={setOverlayLayoutSettings}
          overlayPositionEditEnabled={overlayPositionEditEnabled}
          onOverlayPositionEditEnabledChange={setOverlayPositionEditEnabled}
          cameraEnabled={trackingCameraEnabled}
          onCameraEnabledChange={setTrackingCameraEnabled}
          cameraBackdropEnabled={trackingBackdropEnabled}
          onCameraBackdropEnabledChange={setTrackingBackdropEnabled}
          cameraBackdropOpacity={trackingBackdropOpacity}
          onCameraBackdropOpacityChange={setTrackingBackdropOpacity}
          headFollowPositionEnabled={headFollowPositionEnabled}
          onHeadFollowPositionEnabledChange={setHeadFollowPositionEnabled}
          headFollowPositionStrength={headFollowPositionStrength}
          onHeadFollowPositionStrengthChange={setHeadFollowPositionStrength}
          headXAxisMapping={headXAxisMapping}
          headYAxisMapping={headYAxisMapping}
          onHeadXAxisMappingChange={setHeadXAxisMapping}
          onHeadYAxisMappingChange={setHeadYAxisMapping}
          isolateHeadXDebug={isolateHeadXDebug}
          onIsolateHeadXDebugChange={setIsolateHeadXDebug}
          isolateHeadYDebug={isolateHeadYDebug}
          onIsolateHeadYDebugChange={setIsolateHeadYDebug}
          rotationAxisDebugEnabled={rotationAxisDebugEnabled}
          onRotationAxisDebugEnabledChange={setRotationAxisDebugEnabled}
          cameraDeviceId={trackingCameraDeviceId}
          onCameraDeviceIdChange={setTrackingCameraDeviceId}
          cameraOptions={cameraOptions}
          flipX={trackingFlipX}
          onFlipXChange={setTrackingFlipX}
          flipY={trackingFlipY}
          onFlipYChange={setTrackingFlipY}
          listenerMode={listenerMode}
          onListenerModeChange={handleListenerModeChange}
          isBroadcaster={isBroadcaster}
          activeBroadcasterId={activeBroadcasterId}
          syncWarning={orbSyncError ?? orbRoleWarning}
          remotePointerControlEnabled={remotePointerControlEnabled}
          onRemotePointerControlEnabledChange={setRemotePointerControlEnabled}
          isFullscreen={isFullscreen}
          onFullscreenToggle={() => {
            void handleToggleFullscreen();
          }}
          autoplayEnabled={orbAutoplayEnabled}
          onAutoplayEnabledChange={setOrbAutoplayEnabled}
        />
      )}
    </>
  );
};

export default ModelCanvas;
