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
import { ArrowDirection, Move } from "../atoms/model-arrow";
import ModelEnv from "../atoms/model-env";
import SubjectPresence, { TrackedSubject } from "../atoms/subject-presence";
import GlassOrb3DProjection from "../atoms/glass-orb-3d-projection";
import GlassOrbProjection, {
  DEFAULT_GLASS_ORB_SETTINGS,
  GlassOrbSettings,
} from "../atoms/glass-orb-projection";
import {
  CONFIG,
  DirectionTuple,
  ProjectId,
  SUPABASE_URL,
  TLanguage,
} from "@/config/config";
import {
  LinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  VideoTexture,
} from "three";
import { usePathname, useRouter } from "next/navigation";
import SubtitleText from "./subtitle-text";
import { useLanguageContext } from "@/contexts/language-context";
import useRestrictedUiAccess from "@/hooks/useRestrictedUiAccess";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogv", ".ogg"];
const AUDIO_UNLOCK_SESSION_KEY = "streets_audio_unlocked";
const ORB_AUTOPLAY_INTERVAL_MS = 2600;
const ORB_AUTOPLAY_START_INDEX = 1;
const ORB_AUTOPLAY_END_INDEX = 30;

declare global {
  interface Window {
    __streetsAudioUnlocked?: boolean;
  }
}

const stripQueryAndHash = (url: string) => url.split("#")[0].split("?")[0];

const isVideoMediaUrl = (url: string) => {
  const normalizedUrl = stripQueryAndHash(url).toLowerCase();
  return VIDEO_EXTENSIONS.some((extension) => normalizedUrl.endsWith(extension));
};

const hasUserActivatedPage = () => {
  if (typeof navigator === "undefined") {
    return false;
  }

  return Boolean(
    (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } })
      .userActivation?.hasBeenActive,
  );
};

const isAudioUnlockRemembered = () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.__streetsAudioUnlocked) {
    return true;
  }

  try {
    if (window.sessionStorage.getItem(AUDIO_UNLOCK_SESSION_KEY) === "1") {
      window.__streetsAudioUnlocked = true;
      return true;
    }
  } catch {
    // Ignore storage access failures.
  }

  if (hasUserActivatedPage()) {
    window.__streetsAudioUnlocked = true;
    return true;
  }

  return false;
};

const rememberAudioUnlock = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.__streetsAudioUnlocked = true;
  try {
    window.sessionStorage.setItem(AUDIO_UNLOCK_SESSION_KEY, "1");
  } catch {
    // Ignore storage access failures.
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

const getLocalAssetFallbackPath = (mediaUrl: string) => {
  if (!mediaUrl || mediaUrl.startsWith("data:") || mediaUrl.startsWith("blob:")) {
    return null;
  }

  try {
    const supabasePublicPath = new URL(SUPABASE_URL).pathname.replace(/\/+$/, "");
    const mediaPath = new URL(mediaUrl, "http://localhost").pathname;
    const normalizedMediaPath = mediaPath.replace(/\/+$/, "");

    if (!normalizedMediaPath.startsWith(`${supabasePublicPath}/`)) {
      return null;
    }

    const relativePath = normalizedMediaPath.slice(supabasePublicPath.length + 1);
    if (!relativePath.length) {
      return null;
    }

    console.log('Media URL failed to load, falling back to local asset if available:', `assets/${relativePath}`);

    return `/assets/${relativePath}`;
  } catch {
    return null;
  }
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

const useActiveMediaTexture = (mediaUrl: string) => {
  const [activeTexture, setActiveTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let disposed = false;
    let localVideoElement: HTMLVideoElement | null = null;
    let localTexture: Texture | null = null;
    const fallbackMediaUrl = getLocalAssetFallbackPath(mediaUrl);

    if (isVideoMediaUrl(mediaUrl)) {
      const videoElement = document.createElement("video");
      videoElement.crossOrigin = "anonymous";
      videoElement.loop = true;
      videoElement.muted = !isAudioUnlockRemembered();
      videoElement.volume = 1;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.preload = "auto";
      let hasAttemptedFallback = false;
      let audioUnlocked = isAudioUnlockRemembered();

      const tryUnlockVideoAudio = () => {
        if (disposed) {
          return;
        }

        if (audioUnlocked && !videoElement.muted) {
          return;
        }

        videoElement.muted = false;
        videoElement.play().catch(() => {
          videoElement.muted = true;
          audioUnlocked = false;
        }).then(() => {
          if (videoElement.muted) {
            return;
          }

          audioUnlocked = true;
          rememberAudioUnlock();
        });
      };

      const handleUserInteractionForAudio = () => {
        tryUnlockVideoAudio();
      };

      const setVideoSource = (nextSource: string) => {
        videoElement.src = nextSource;
        videoElement.load();
        videoElement.play().catch(() => {
          // Ignore autoplay blocking; the texture will animate once playback starts.
        });
      };

      const handleVideoError = () => {
        if (disposed) {
          return;
        }

        if (!hasAttemptedFallback && fallbackMediaUrl && videoElement.src !== fallbackMediaUrl) {
          hasAttemptedFallback = true;
          setVideoSource(fallbackMediaUrl);
          return;
        }

        setActiveTexture(null);
      };
      videoElement.addEventListener("error", handleVideoError);
      window.addEventListener("pointerdown", handleUserInteractionForAudio);
      window.addEventListener("keydown", handleUserInteractionForAudio);
      window.addEventListener("touchstart", handleUserInteractionForAudio);

      const videoTexture = new VideoTexture(videoElement);
      videoTexture.colorSpace = SRGBColorSpace;
      videoTexture.minFilter = LinearFilter;
      videoTexture.magFilter = LinearFilter;
      videoTexture.generateMipmaps = false;

      localVideoElement = videoElement;
      localTexture = videoTexture;
      setActiveTexture(videoTexture);
      setVideoSource(mediaUrl);
      if (audioUnlocked) {
        tryUnlockVideoAudio();
      }

      const cleanupVideoEvents = () => {
        videoElement.removeEventListener("error", handleVideoError);
        window.removeEventListener("pointerdown", handleUserInteractionForAudio);
        window.removeEventListener("keydown", handleUserInteractionForAudio);
        window.removeEventListener("touchstart", handleUserInteractionForAudio);
      };

      // Reuse this cleanup in effect return via closure.
      (videoElement as HTMLVideoElement & { __cleanupVideoEvents?: () => void }).__cleanupVideoEvents =
        cleanupVideoEvents;
    } else {
      const loader = new TextureLoader();
      let hasAttemptedFallback = false;

      const loadTexture = (source: string) => {
        loader.load(
          source,
          (texture) => {
            if (disposed) {
              texture.dispose();
              return;
            }
            texture.colorSpace = SRGBColorSpace;
            localTexture = texture;
            setActiveTexture(texture);
          },
          undefined,
          () => {
            if (disposed) {
              return;
            }

            if (!hasAttemptedFallback && fallbackMediaUrl && source !== fallbackMediaUrl) {
              hasAttemptedFallback = true;
              loadTexture(fallbackMediaUrl);
              return;
            }

            setActiveTexture(null);
          },
        );
      };

      loadTexture(mediaUrl);
    }

    return () => {
      disposed = true;

      if (localTexture) {
        setActiveTexture((current) => (current === localTexture ? null : current));
        localTexture.dispose();
      }

      if (localVideoElement) {
        (
          localVideoElement as HTMLVideoElement & {
            __cleanupVideoEvents?: () => void;
          }
        ).__cleanupVideoEvents?.();
        localVideoElement.pause();
        localVideoElement.src = "";
        localVideoElement.load();
      }
    };
  }, [mediaUrl]);

  return activeTexture;
};

const orbControlRanges: Array<{
  id: keyof Pick<GlassOrbSettings, "radius" | "yaw" | "xRotation">;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { id: "radius", label: "Orb Size", min: 1.2, max: 2.6, step: 0.01 },
  {
    id: "yaw",
    label: "Y Rotation",
    min: -Math.PI,
    max: Math.PI,
    step: 0.01,
  },
  {
    id: "xRotation",
    label: "X Rotation",
    min: -Math.PI / 4,
    max: Math.PI / 4,
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
  debugEnabled: boolean;
  onDebugEnabledChange: React.Dispatch<React.SetStateAction<boolean>>;
  autoplayEnabled: boolean;
  onAutoplayEnabledChange: (enabled: boolean) => void;
}> = ({
  settings,
  onChange,
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
  debugEnabled,
  onDebugEnabledChange,
  autoplayEnabled,
  onAutoplayEnabledChange,
}) => {
  return (
    <div className="fixed bottom-4 left-4 z-20 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-black/70 p-4 text-xs text-white backdrop-blur-md">
      <div className="mb-3">
        <p className="font-semibold uppercase tracking-[0.2em] text-white/75">
          Orb Controller
        </p>
        <p className="mt-1 text-white/60">
          Move the mouse to steer the orb across X/Y. Rotation is smoothed for
          a softer, gliding feel. Press C to hide/show this panel. Press H to
          hide/show this panel and tracking debug together.
        </p>
      </div>
      <div className="space-y-3">
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
                checked={debugEnabled}
                onChange={(event) => onDebugEnabledChange(event.target.checked)}
                type="checkbox"
              />
              Debug Camera Canvas
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

const OrbFullscreenButton: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    if (typeof document === "undefined") {
      return;
    }

    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      return;
    }

    await document.exitFullscreen();
  };

  return (
    <button
      className="fixed right-4 top-4 z-20 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-md"
      onClick={handleToggleFullscreen}
      type="button"
    >
      {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
    </button>
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

const getMoveLabel = (
  direction: ArrowDirection,
  tooltip: string | null,
): string => {
  if (tooltip) {
    return tooltip;
  }

  switch (direction) {
    case "reverse":
      return "Reverse";
    case "forward":
      return "Forward";
    case "left":
      return "Left";
    case "right":
      return "Right";
    case "up":
      return "Up";
    case "down":
      return "Down";
  }
};

const EquirectangularView: React.FC<{
  mediaUrl: string;
  isVideo: boolean;
  currentMoves: DirectionTuple[];
  onMove: (value: number) => void;
}> = ({ mediaUrl, isVideo, currentMoves, onMove }) => {
  const fallbackMediaUrl = getLocalAssetFallbackPath(mediaUrl);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState(mediaUrl);
  const [videoMuted, setVideoMuted] = useState(() => !isAudioUnlockRemembered());
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setResolvedMediaUrl(mediaUrl);
    setVideoMuted(!isAudioUnlockRemembered());
  }, [mediaUrl]);

  useEffect(() => {
    if (!isVideo) {
      return;
    }

    const unlockAudio = () => {
      setVideoMuted(false);
      const target = videoRef.current;
      if (!target) {
        return;
      }

      target.muted = false;
      target
        .play()
        .catch(() => {
          target.muted = true;
          setVideoMuted(true);
        })
        .then(() => {
          if (target.muted) {
            return;
          }

          setVideoMuted(false);
          rememberAudioUnlock();
        });
    };

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);
    if (isAudioUnlockRemembered()) {
      unlockAudio();
    }

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, [isVideo, resolvedMediaUrl]);

  const handleMediaError = useCallback(() => {
    if (!fallbackMediaUrl) {
      return;
    }

    setResolvedMediaUrl((current) =>
      current === fallbackMediaUrl ? current : fallbackMediaUrl,
    );
  }, [fallbackMediaUrl]);

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        {isVideo ? (
          <video
            autoPlay
            className="h-full w-full object-contain"
            loop
            muted={videoMuted}
            playsInline
            ref={videoRef}
            src={resolvedMediaUrl}
            onError={handleMediaError}
          />
        ) : (
          <img
            alt="Equirectangular panorama"
            className="h-full w-full object-contain"
            onError={handleMediaError}
            src={resolvedMediaUrl}
          />
        )}
      </div>
      <div className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/70 p-2 backdrop-blur-md">
        {currentMoves.map(([direction, value, tooltip], idx) => (
          <button
            className="rounded-full border border-white/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white hover:text-black"
            key={`${direction}-${value}-${idx}`}
            onClick={() => onMove(value)}
            type="button"
          >
            {getMoveLabel(direction, tooltip)}
          </button>
        ))}
      </div>
    </>
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
  orbMode?: boolean;
  orb3DMode?: boolean;
  orbSettings: GlassOrbSettings;
  trackedSubjects: TrackedSubject[];
  headFollowPositionEnabled: boolean;
  headFollowPositionStrength: number;
  sphereDefaultRotationOffset: number;
}> = ({
  projectId,
  currentModel,
  moveProps,
  mediaUrls,
  withSubtitle,
  doubleBy,
  scale,
  orbMode,
  orb3DMode,
  orbSettings,
  trackedSubjects,
  headFollowPositionEnabled,
  headFollowPositionStrength,
  sphereDefaultRotationOffset,
}) => {
  const textureIndex = (doubleBy ? doubleBy + currentModel : currentModel) - 1;
  const activeMediaUrl =
    mediaUrls[Math.min(Math.max(textureIndex, 0), mediaUrls.length - 1)];
  const activeTexture = useActiveMediaTexture(activeMediaUrl);
  const isOrbVisualMode = Boolean(orbMode || orb3DMode);

  if (!activeTexture) {
    return null;
  }

  return (
    <>
      <ambientLight intensity={isOrbVisualMode ? 0.35 : 0.5} />
      <directionalLight
        intensity={isOrbVisualMode ? 1.9 : 1}
        position={isOrbVisualMode ? [6, 4, 8] : [5, 5, 5]}
      />
      {orb3DMode ? (
        <GlassOrb3DProjection
          texture={activeTexture}
          settings={orbSettings}
          trackedSubjects={trackedSubjects}
          headFollowPositionEnabled={headFollowPositionEnabled}
          headFollowPositionStrength={headFollowPositionStrength}
          listenerMode={false}
          remoteRotation={null}
          onRotationChange={() => {}}
        />
      ) : orbMode ? (
        <GlassOrbProjection
          texture={activeTexture}
          settings={orbSettings}
          trackedSubjects={trackedSubjects}
          headFollowPositionEnabled={headFollowPositionEnabled}
          headFollowPositionStrength={headFollowPositionStrength}
          listenerMode={false}
          remoteRotation={null}
          onRotationChange={() => {}}
        />
      ) : (
        <>
          <ModelEnv
            rotation={[0, Math.PI / 2 + sphereDefaultRotationOffset, 0]}
            texture={activeTexture}
            scale={scale ?? [-1, 1, 1]}
          />
          {withSubtitle && CONFIG[projectId].text[currentModel] && (
            <SubtitleText>{CONFIG[projectId].text[currentModel]}</SubtitleText>
          )}
        </>
      )}
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
}> = ({ projectId, imageId, className, withSubtitle, column, doubleBy, scale }) => {
  const pathname = usePathname();
  const router = useRouter();
  const isRestrictedUiAllowed = useRestrictedUiAccess();
  const [viewMode, setViewMode] = useState<
    "sphere" | "orb" | "orb3d" | "equirect"
  >(
    "sphere",
  );
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
  const [showOrbControls, setShowOrbControls] = useState(true);
  const [trackedSubjects, setTrackedSubjects] = useState<TrackedSubject[]>([]);
  const [trackingCameraEnabled, setTrackingCameraEnabled] = useState(false);
  const [trackingCameraDeviceId, setTrackingCameraDeviceId] = useState("");
  const [trackingFlipX, setTrackingFlipX] = useState(false);
  const [trackingFlipY, setTrackingFlipY] = useState(false);
  const [trackingDebugEnabled, setTrackingDebugEnabled] = useState(true);
  const [trackingBackdropEnabled, setTrackingBackdropEnabled] = useState(true);
  const [trackingBackdropOpacity, setTrackingBackdropOpacity] = useState(0.66);
  const [headFollowPositionEnabled, setHeadFollowPositionEnabled] =
    useState(false);
  const [headFollowPositionStrength, setHeadFollowPositionStrength] =
    useState(1);
  const [hideOrbHud, setHideOrbHud] = useState(false);
  const [cameraOptions, setCameraOptions] = useState<CameraOption[]>([]);
  const [orbAutoplayEnabled, setOrbAutoplayEnabledState] = useState(true);

  useEffect(() => {
    setCurrentModel(parseInt(currentIndexToPathname));
  }, [currentIndexToPathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    if (
      isRestrictedUiAllowed &&
      (view === "orb" || view === "orb3d" || view === "equirect")
    ) {
      setViewMode(view);
      return;
    }
    setViewMode("sphere");
  }, [isRestrictedUiAllowed, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setOrbAutoplayEnabledState(params.get("autoplay") !== "off");
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || !isRestrictedUiAllowed) {
      return;
    }

    const handleFullscreenToggle = async (event: KeyboardEvent) => {
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

      const doc = document as Document & {
        webkitExitFullscreen?: () => Promise<void> | void;
        webkitFullscreenElement?: Element | null;
      };
      const root = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };

      const isFullscreen = Boolean(
        doc.fullscreenElement || doc.webkitFullscreenElement,
      );

      try {
        if (isFullscreen) {
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
    };

    window.addEventListener("keydown", handleFullscreenToggle);
    return () => {
      window.removeEventListener("keydown", handleFullscreenToggle);
    };
  }, [isRestrictedUiAllowed]);

  const moveProps = {
    projectId: projectId,
    currentModel: currentModel,
    onMove: setCurrentModel,
  };

  const mediaUrls = Array(CONFIG[projectId].numberOfImages)
    .fill(null)
    .map((_, idx) => getMediaPath(projectId, idx + 1));
  const textureIndex = (doubleBy ? doubleBy + currentModel : currentModel) - 1;
  const activeMediaUrl =
    mediaUrls[Math.min(Math.max(textureIndex, 0), mediaUrls.length - 1)];

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
    },
  "2": {
        position: "fixed",
        width: isSmallScreen ? "100vw" : "50vw",
        height: isSmallScreen ? "50vh" : "100vh",
        top: isSmallScreen ? "50vh" : 0,
        left: 0,
    }
  }

  const isOrbMode = viewMode === "orb";
  const isOrb3DMode = viewMode === "orb3d";
  const isOrbLikeMode = isOrbMode || isOrb3DMode;
  const isEquirectMode = viewMode === "equirect";
  const showOrbUi = isRestrictedUiAllowed && isOrbLikeMode && !doubleBy;
  const showEquirectUi = isRestrictedUiAllowed && isEquirectMode && !doubleBy;
  const shouldHideSecondaryOrbCanvas =
    isRestrictedUiAllowed &&
    (isOrbLikeMode || isEquirectMode) &&
    typeof doubleBy === "number";
  const sphereDefaultRotationOffset = useMemo(() => {
    const projectConfig = CONFIG[projectId];
    const locationByKey = projectConfig.location;
    const numericLocationKeys = Object.keys(locationByKey)
      .map((key) => Number.parseInt(key, 10))
      .filter((key) => Number.isFinite(key))
      .sort((a, b) => a - b);

    if (!numericLocationKeys.length) {
      return 0;
    }

    const candidateKeys = numericLocationKeys.filter((key) => key <= currentModel);
    const fallbackKeys = candidateKeys.length ? candidateKeys : numericLocationKeys;

    const locationKeyWithOffset = [...fallbackKeys]
      .reverse()
      .find((key) => {
        const rawOffset = locationByKey[key]?.defaultRotationOffset;
        return parseRotationOffsetToRadians(rawOffset) !== null;
      });

    if (typeof locationKeyWithOffset === "number") {
      const parsedLocationOffset = parseRotationOffsetToRadians(
        locationByKey[locationKeyWithOffset]?.defaultRotationOffset,
      );

      if (parsedLocationOffset !== null) {
        return parsedLocationOffset;
      }
    }

    const parsedProjectOffset = parseRotationOffsetToRadians(
      projectConfig.defaultRotationOffset,
    );
    return parsedProjectOffset ?? 0;
  }, [currentModel, projectId]);
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
      );
    },
    [currentModel, projectId, router],
  );

  useEffect(() => {
    if (!showOrbUi || !isOrbLikeMode || !orbAutoplayEnabled) {
      return;
    }

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
      router.replace(`/${projectId}/${nextModel.toString()}${query}`);
    }, ORB_AUTOPLAY_INTERVAL_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    currentModel,
    isOrbLikeMode,
    maxOrbAutoplayIndex,
    orbAutoplayEnabled,
    projectId,
    router,
    showOrbUi,
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
    router.push(`/${projectId}/${nextModel.toString()}${search}`);
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

  if (showEquirectUi) {
    return (
      <>
        <EquirectangularView
          mediaUrl={activeMediaUrl}
          isVideo={isVideoMediaUrl(activeMediaUrl)}
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
        style={{
          ...(isOrbLikeMode
            ? {
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 10,
                filter: "brightness(1.2) contrast(1.25) saturate(1.06)",
                backgroundColor: "transparent",
              }
            : column
              ? style[column]
              : {}),
        }}
        gl={{
          toneMappingExposure: isOrbLikeMode ? 1.45 : 4,
          alpha: isOrbLikeMode,
        }}
        camera={
          isOrbLikeMode
            ? {
                position: isOrb3DMode ? [0, 0, 8.2] : [0, 0, 4.8],
                fov: isOrb3DMode ? 62 : 55,
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
            orbMode={isOrbMode}
            orb3DMode={isOrb3DMode}
            orbSettings={orbSettings}
            trackedSubjects={trackedSubjects}
            headFollowPositionEnabled={
              headFollowPositionEnabled && trackingCameraEnabled
            }
            headFollowPositionStrength={headFollowPositionStrength}
            sphereDefaultRotationOffset={sphereDefaultRotationOffset}
          />
        </Suspense>
      </Canvas>
      <SubjectPresence
        enabled={showOrbUi}
        cameraEnabled={trackingCameraEnabled}
        cameraDeviceId={trackingCameraDeviceId || undefined}
        flipX={trackingFlipX}
        flipY={trackingFlipY}
        debugEnabled={trackingDebugEnabled && !hideOrbHud}
        cameraBackdropEnabled={trackingBackdropEnabled && trackingCameraEnabled}
        cameraBackdropOpacity={trackingBackdropOpacity}
        onSubjectsChange={setTrackedSubjects}
      />
      {showOrbUi && withSubtitle && (
        <OrbSubtitle projectId={projectId} currentModel={currentModel} />
      )}
      {showOrbUi && <OrbFullscreenButton />}
      {showOrbUi && showOrbControls && !hideOrbHud && (
        <OrbControls
          settings={orbSettings}
          onChange={setOrbSettings}
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
          debugEnabled={trackingDebugEnabled}
          onDebugEnabledChange={setTrackingDebugEnabled}
          autoplayEnabled={orbAutoplayEnabled}
          onAutoplayEnabledChange={setOrbAutoplayEnabled}
        />
      )}
    </>
  );
};

export default ModelCanvas;
