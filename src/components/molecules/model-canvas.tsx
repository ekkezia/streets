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
import ModelLoader from "../atoms/model-loader";
import { Move } from "../atoms/model-arrow";
import ModelEnv from "../atoms/model-env";
import SubjectPresence, { TrackedSubject } from "../atoms/subject-presence";
import GlassOrb3DProjection from "../atoms/glass-orb-3d-projection";
import GlassOrbProjection, {
  DEFAULT_GLASS_ORB_SETTINGS,
  GlassOrbSettings,
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
const ORB_SYNC_POLL_INTERVAL_MS = 300;
const ORB_SYNC_CAMERA_SEND_INTERVAL_MS = 120;
const ORB_SYNC_HEARTBEAT_INTERVAL_MS = 2000;
const ORB_TONE_MAPPING_EXPOSURE = 1.15;
const SPHERE_TONE_MAPPING_EXPOSURE = 1.05;
const PROJECTS_WITH_LOCAL_ASSET_FALLBACK = new Set<ProjectId>([
  "new-york-city",
]);
const PROJECT_MEDIA_PRELOAD_CONCURRENCY = 6;
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
  { id: "radius", label: "Orb Size", min: 1.2, max: 2.6, step: 0.01 },
  {
    id: "yaw",
    label: "Y Rotation",
    min: -Math.PI * 2,
    max: Math.PI * 2,
    step: 0.01,
  },
  {
    id: "xRotation",
    label: "X Rotation",
    min: -Math.PI,
    max: Math.PI,
    step: 0.01,
  },
  {
    id: "zRotation",
    label: "Z Rotation",
    min: -Math.PI * 2,
    max: Math.PI * 2,
    step: 0.01,
  },
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

const OrbControls: React.FC<{
  settings: GlassOrbSettings;
  onChange: React.Dispatch<React.SetStateAction<GlassOrbSettings>>;
  onHide: () => void;
  overlayLayoutSettings: OverlayLayoutSettings;
  onOverlayLayoutSettingsChange: React.Dispatch<
    React.SetStateAction<OverlayLayoutSettings>
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
  onHide,
  overlayLayoutSettings,
  onOverlayLayoutSettingsChange,
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
            <div className="mb-1 flex items-center justify-between gap-3">
              <span>{label}</span>
              <span className="font-mono text-[11px] text-white/70">
                {settings[id].toFixed(2)}
              </span>
            </div>
            <input
              className="w-full accent-white"
              type="range"
              min={min}
              max={max}
              step={step}
              value={settings[id]}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  [id]: parseFloat(event.target.value),
                }))
              }
            />
          </label>
        ))}
        <div className="space-y-2 rounded-lg border border-white/15 bg-white/5 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
            Overlay Position
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
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            className="rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-black"
            onClick={() => onChange(DEFAULT_GLASS_ORB_SETTINGS)}
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
  orbMode?: boolean;
  orb3DMode?: boolean;
  orbSettings: GlassOrbSettings;
  trackedSubjects: TrackedSubject[];
  headFollowPositionEnabled: boolean;
  headFollowPositionStrength: number;
  listenerMode: boolean;
  remotePointerControlEnabled: boolean;
  remoteOrbRotation: OrbRotationSnapshot | null;
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
  orbMode,
  orb3DMode,
  orbSettings,
  trackedSubjects,
  headFollowPositionEnabled,
  headFollowPositionStrength,
  listenerMode,
  remotePointerControlEnabled,
  remoteOrbRotation,
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
    yaw: orbSettings.yaw + rotationOffset[1],
    xRotation: orbSettings.xRotation + rotationOffset[0],
    zRotation: orbSettings.zRotation + rotationOffset[2],
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
          listenerMode={listenerMode}
          allowPointerControlInListenerMode={remotePointerControlEnabled}
          remoteRotation={remoteOrbRotation}
          onRotationChange={() => {}}
        />
      ) : orbMode ? (
        <GlassOrbProjection
          texture={activeTexture}
          settings={effectiveOrbSettings}
          trackedSubjects={trackedSubjects}
          headFollowPositionEnabled={headFollowPositionEnabled}
          headFollowPositionStrength={headFollowPositionStrength}
          listenerMode={listenerMode}
          allowPointerControlInListenerMode={remotePointerControlEnabled}
          remoteRotation={remoteOrbRotation}
          onRotationChange={() => {}}
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
      {!isOrbVisualMode && <OrbitControls maxDistance={5} />}
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
  const [showOrbControls, setShowOrbControls] = useState(false);
  const [trackedSubjects, setTrackedSubjects] = useState<TrackedSubject[]>([]);
  const [trackingCameraEnabled, setTrackingCameraEnabled] = useState(false);
  const [trackingCameraDeviceId, setTrackingCameraDeviceId] = useState("");
  const [trackingFlipX, setTrackingFlipX] = useState(false);
  const [trackingFlipY, setTrackingFlipY] = useState(false);
  const [trackingBackdropEnabled, setTrackingBackdropEnabled] = useState(true);
  const [trackingBackdropOpacity, setTrackingBackdropOpacity] = useState(0.66);
  const [headFollowPositionEnabled, setHeadFollowPositionEnabled] =
    useState(false);
  const [headFollowPositionStrength, setHeadFollowPositionStrength] =
    useState(1);
  const [hideOrbHud, setHideOrbHud] = useState(false);
  const [cameraOptions, setCameraOptions] = useState<CameraOption[]>([]);
  const [orbAutoplayEnabled, setOrbAutoplayEnabledState] = useState(true);
  const orbClientIdRef = useRef(
    `orb-${Math.random().toString(36).slice(2, 10)}`,
  );
  const [listenerMode, setListenerMode] = useState(false);
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  const [activeBroadcasterId, setActiveBroadcasterId] = useState<string | null>(
    null,
  );
  const [remoteOrbRotation, setRemoteOrbRotation] =
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
  const useLocalAssetFallback = PROJECTS_WITH_LOCAL_ASSET_FALLBACK.has(
    projectId,
  );
  const [projectMediaPreloadReady, setProjectMediaPreloadReady] = useState(false);
  const [projectMediaPreloadLoaded, setProjectMediaPreloadLoaded] = useState(0);
  const hasSecondaryCanvas = typeof doubleBy === "number";
  const {
    overlayLayoutSettings,
    setOverlayLayoutSettings,
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
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setOrbAutoplayEnabledState(params.get("autoplay") !== "off");
  }, [pathname]);

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

    setProjectMediaPreloadReady(false);
    setProjectMediaPreloadLoaded(0);

    let nextIndex = 0;
    const worker = async () => {
      while (!disposed && !controller.signal.aborted) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= mediaUrls.length) {
          break;
        }

        await preloadSceneMedia(
          mediaUrls[index],
          useLocalAssetFallback,
          controller.signal,
        );

        if (!disposed) {
          setProjectMediaPreloadLoaded((count) => count + 1);
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(PROJECT_MEDIA_PRELOAD_CONCURRENCY, mediaUrls.length) },
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
    projectId,
    shouldHideSecondaryOrbCanvas,
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
    setListenerMode(enabled);
    setOrbRoleWarning(null);
    setOrbSyncError(null);
    if (enabled) {
      setIsBroadcaster(false);
    }
  }, []);

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
          rotation?: { yaw?: number; xRotation?: number } | null;
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
        setIsBroadcaster(isSelfBroadcaster);

        if (shouldUseRemoteRotation) {
          const yaw = payload.rotation?.yaw;
          const xRotation = payload.rotation?.xRotation;
          if (Number.isFinite(yaw) && Number.isFinite(xRotation)) {
            setRemoteOrbRotation({
              yaw: yaw as number,
              xRotation: xRotation as number,
            });
          } else {
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
        .then(() => {
          if (!disposed) {
            setOrbSyncError(null);
          }
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
            orbMode={isOrbMode}
            orb3DMode={isOrb3DMode}
            orbSettings={orbSettings}
            trackedSubjects={trackedSubjects}
            headFollowPositionEnabled={
              headFollowPositionEnabled && trackingCameraEnabled
            }
            headFollowPositionStrength={headFollowPositionStrength}
            listenerMode={listenerMode || isBroadcaster}
            remotePointerControlEnabled={remotePointerControlEnabled}
            remoteOrbRotation={
              listenerMode || isBroadcaster ? remoteOrbRotation : null
            }
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
      {showOrbUi && !showOrbControls && !hideOrbHud && (
        <button
          aria-label="Show orb controller"
          className="fixed bottom-4 left-4 z-[11000] rounded-r-xl border border-white/20 bg-black/70 px-3 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white hover:text-black"
          onClick={() => setShowOrbControls(true)}
          type="button"
        >
          ▶
        </button>
      )}
      {showOrbUi && showOrbControls && !hideOrbHud && (
        <OrbControls
          settings={orbSettings}
          onChange={setOrbSettings}
          onHide={() => setShowOrbControls(false)}
          overlayLayoutSettings={overlayLayoutSettings}
          onOverlayLayoutSettingsChange={setOverlayLayoutSettings}
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
