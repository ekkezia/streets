"use client";

import { useEffect, useState } from "react";
import {
  LinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  VideoTexture,
} from "three";
import {
  getLocalAssetFallbackPath,
  isAudioUnlockRemembered,
  isVideoMediaUrl,
  rememberAudioUnlock,
} from "./model-canvas-media";

type SharedVideoSession = {
  videoElement: HTMLVideoElement;
  videoTexture: VideoTexture;
  audioUnlocked: boolean;
  transcriptSyncKey?: string;
};

const sharedVideoSessions = new Map<string, SharedVideoSession>();
let globalAudioUnlockListenersBound = false;
const MEDIA_TRANSCRIPT_SYNC_EVENT = "streets-media-transcript-sync";

const emitTranscriptSync = (transcriptSyncKey?: string) => {
  if (!transcriptSyncKey || typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(MEDIA_TRANSCRIPT_SYNC_EVENT, {
      detail: { key: transcriptSyncKey },
    }),
  );
};

const bindGlobalAudioUnlockListeners = () => {
  if (typeof window === "undefined" || globalAudioUnlockListenersBound) {
    return;
  }

  const unlockAllSessions = () => {
    rememberAudioUnlock();

    sharedVideoSessions.forEach((session) => {
      const target = session.videoElement;
      const wasAudioUnlocked = session.audioUnlocked;
      target.muted = false;
      void target
        .play()
        .then(() => {
          session.audioUnlocked = true;
          if (!wasAudioUnlocked) {
            emitTranscriptSync(session.transcriptSyncKey);
          }
        })
        .catch(() => {
          // Keep muted fallback when browser policy still blocks playback.
          target.muted = true;
          void target.play().catch(() => {
            // Ignore autoplay failure for muted fallback.
          });
        });
    });
  };

  window.addEventListener("pointerdown", unlockAllSessions);
  window.addEventListener("keydown", unlockAllSessions);
  window.addEventListener("touchstart", unlockAllSessions);
  globalAudioUnlockListenersBound = true;
};

const getOrCreateSharedVideoSession = (sessionKey: string): SharedVideoSession => {
  const cached = sharedVideoSessions.get(sessionKey);
  if (cached) {
    return cached;
  }

  const videoElement = document.createElement("video");
  videoElement.crossOrigin = "anonymous";
  videoElement.loop = true;
  videoElement.autoplay = true;
  videoElement.playsInline = true;
  videoElement.setAttribute("playsinline", "true");
  videoElement.setAttribute("webkit-playsinline", "true");
  videoElement.preload = "auto";
  videoElement.volume = 1;
  videoElement.muted = !isAudioUnlockRemembered();

  const videoTexture = new VideoTexture(videoElement);
  videoTexture.colorSpace = SRGBColorSpace;
  videoTexture.minFilter = LinearFilter;
  videoTexture.magFilter = LinearFilter;
  videoTexture.generateMipmaps = false;

  const nextSession: SharedVideoSession = {
    videoElement,
    videoTexture,
    audioUnlocked: isAudioUnlockRemembered(),
    transcriptSyncKey: undefined,
  };

  sharedVideoSessions.set(sessionKey, nextSession);
  bindGlobalAudioUnlockListeners();
  return nextSession;
};

const pauseSharedVideoSession = (sessionKey: string) => {
  const session = sharedVideoSessions.get(sessionKey);
  if (!session) {
    return;
  }

  session.videoElement.pause();
};

export const useActiveMediaTexture = (
  mediaUrl: string,
  useLocalAssetFallback = false,
  sessionKey = "default",
  transcriptSyncKey?: string,
) => {
  const [activeTexture, setActiveTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let disposed = false;
    let localTexture: Texture | null = null;
    let cleanupVideoHandlers: (() => void) | null = null;
    let cleanupTranscriptHandlers: (() => void) | null = null;
    const fallbackMediaUrl = useLocalAssetFallback
      ? getLocalAssetFallbackPath(mediaUrl)
      : null;

    if (isVideoMediaUrl(mediaUrl)) {
      const session = getOrCreateSharedVideoSession(sessionKey);
      const videoElement = session.videoElement;
      let hasAttemptedFallback = false;
      let hasDispatchedInitialTranscriptSync = false;
      let previousVideoTime = videoElement.currentTime;
      session.audioUnlocked = session.audioUnlocked || isAudioUnlockRemembered();
      session.transcriptSyncKey = transcriptSyncKey;

      const attemptPlayback = async (preferUnmuted: boolean) => {
        if (disposed) {
          return false;
        }

        if (preferUnmuted) {
          videoElement.muted = false;
          try {
            await videoElement.play();
            session.audioUnlocked = true;
            rememberAudioUnlock();
            return true;
          } catch {
            // Continue with muted fallback for Safari/iPad autoplay policy.
          }
        }

        videoElement.muted = true;
        try {
          await videoElement.play();
        } catch {
          // Keep paused if browser still blocks playback.
        }

        return false;
      };

      const setVideoSource = (nextSource: string) => {
        if (videoElement.src !== nextSource) {
          hasDispatchedInitialTranscriptSync = false;
          previousVideoTime = 0;
          videoElement.src = nextSource;
          videoElement.load();
        }
        const shouldPreferUnmuted =
          session.audioUnlocked || isAudioUnlockRemembered();
        void attemptPlayback(shouldPreferUnmuted);
      };

      const handleVideoPlaying = () => {
        if (hasDispatchedInitialTranscriptSync) {
          return;
        }

        hasDispatchedInitialTranscriptSync = true;
        emitTranscriptSync(session.transcriptSyncKey);
      };

      const handleVideoTimeUpdate = () => {
        const currentTime = videoElement.currentTime;
        if (
          Number.isFinite(currentTime) &&
          Number.isFinite(previousVideoTime) &&
          currentTime + 0.25 < previousVideoTime
        ) {
          emitTranscriptSync(session.transcriptSyncKey);
        }
        previousVideoTime = currentTime;
      };

      videoElement.addEventListener("playing", handleVideoPlaying);
      videoElement.addEventListener("timeupdate", handleVideoTimeUpdate);
      cleanupTranscriptHandlers = () => {
        videoElement.removeEventListener("playing", handleVideoPlaying);
        videoElement.removeEventListener("timeupdate", handleVideoTimeUpdate);
      };

      const retryPlaybackWhenReady = () => {
        if (disposed) {
          return;
        }

        const shouldPreferUnmuted =
          session.audioUnlocked || isAudioUnlockRemembered();
        void attemptPlayback(shouldPreferUnmuted);
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
      videoElement.addEventListener("loadedmetadata", retryPlaybackWhenReady);
      videoElement.addEventListener("canplay", retryPlaybackWhenReady);
      cleanupVideoHandlers = () => {
        videoElement.removeEventListener("error", handleVideoError);
        videoElement.removeEventListener(
          "loadedmetadata",
          retryPlaybackWhenReady,
        );
        videoElement.removeEventListener("canplay", retryPlaybackWhenReady);
      };

      setActiveTexture(session.videoTexture);
      setVideoSource(mediaUrl);
    } else {
      pauseSharedVideoSession(sessionKey);

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

      cleanupVideoHandlers?.();
      cleanupTranscriptHandlers?.();
    };
  }, [mediaUrl, sessionKey, transcriptSyncKey, useLocalAssetFallback]);

  return activeTexture;
};
