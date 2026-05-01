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
  createPairedAudioController,
  getLocalAssetFallbackPath,
  isAudioUnlockRemembered,
  isVideoMediaUrl,
  rememberAudioUnlock,
} from "./model-canvas-media";

type SharedVideoSession = {
  videoElement: HTMLVideoElement;
  videoTexture: VideoTexture;
  pairedAudioController: ReturnType<typeof createPairedAudioController>;
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
        .then(async () => {
          const pairedAudioStarted = await session.pairedAudioController.syncAndPlay();
          if (pairedAudioStarted) {
            session.audioUnlocked = true;
            if (!wasAudioUnlocked) {
              emitTranscriptSync(session.transcriptSyncKey);
            }
          }
        })
        .catch(() => {
          // Keep muted fallback when browser policy still blocks playback.
          target.muted = true;
          session.pairedAudioController.pause();
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

  const pairedAudioController = createPairedAudioController(videoElement);
  pairedAudioController.bindVideoEvents();

  const videoTexture = new VideoTexture(videoElement);
  videoTexture.colorSpace = SRGBColorSpace;
  videoTexture.minFilter = LinearFilter;
  videoTexture.magFilter = LinearFilter;
  videoTexture.generateMipmaps = false;

  const nextSession: SharedVideoSession = {
    videoElement,
    videoTexture,
    pairedAudioController,
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
  session.pairedAudioController.pause();
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
    let cleanupAudioHandlers: (() => void) | null = null;
    const fallbackMediaUrl = useLocalAssetFallback
      ? getLocalAssetFallbackPath(mediaUrl)
      : null;

    if (isVideoMediaUrl(mediaUrl)) {
      const session = getOrCreateSharedVideoSession(sessionKey);
      const videoElement = session.videoElement;
      const pairedAudioController = session.pairedAudioController;
      let hasAttemptedFallback = false;
      let hasDispatchedInitialTranscriptSync = false;
      session.audioUnlocked = session.audioUnlocked || isAudioUnlockRemembered();
      session.transcriptSyncKey = transcriptSyncKey;

      const attemptPlayback = async (preferUnmuted: boolean) => {
        if (disposed) {
          return false;
        }

        if (preferUnmuted) {
          videoElement.muted = false;
          const wasAudioUnlocked = session.audioUnlocked;
          try {
            await videoElement.play();
            const pairedAudioStarted = await pairedAudioController?.syncAndPlay();
            if (pairedAudioStarted) {
              session.audioUnlocked = true;
              rememberAudioUnlock();
              if (!hasDispatchedInitialTranscriptSync || !wasAudioUnlocked) {
                hasDispatchedInitialTranscriptSync = true;
                emitTranscriptSync(session.transcriptSyncKey);
              }
            }
            return true;
          } catch {
            // Continue with muted fallback for Safari/iPad autoplay policy.
          }
        }

        videoElement.muted = true;
        pairedAudioController?.pause();
        try {
          await videoElement.play();
        } catch {
          // Keep paused if browser still blocks playback.
        }

        return false;
      };

      const setVideoSource = (nextSource: string) => {
        pairedAudioController?.setSource(nextSource);
        if (videoElement.src !== nextSource) {
          hasDispatchedInitialTranscriptSync = false;
          videoElement.src = nextSource;
          videoElement.load();
        }
        const shouldPreferUnmuted =
          session.audioUnlocked || isAudioUnlockRemembered();
        void attemptPlayback(shouldPreferUnmuted);
      };

      const unbindPairedAudioPlay = pairedAudioController.bindPairedAudioPlay(() => {
        const wasAudioUnlocked = session.audioUnlocked;
        session.audioUnlocked = true;
        if (!hasDispatchedInitialTranscriptSync || !wasAudioUnlocked) {
          hasDispatchedInitialTranscriptSync = true;
          emitTranscriptSync(session.transcriptSyncKey);
        }
      });
      const unbindPairedAudioLoop = pairedAudioController.bindPairedAudioLoop(() => {
        if (session.audioUnlocked && !videoElement.muted) {
          emitTranscriptSync(session.transcriptSyncKey);
        }
      });
      cleanupAudioHandlers = () => {
        unbindPairedAudioPlay();
        unbindPairedAudioLoop();
      };

      const retryUnmutedPlaybackIfUnlocked = () => {
        if (disposed) {
          return;
        }

        const shouldPreferUnmuted =
          session.audioUnlocked || isAudioUnlockRemembered();
        if (!shouldPreferUnmuted) {
          return;
        }

        void attemptPlayback(true);
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
      videoElement.addEventListener("loadedmetadata", retryUnmutedPlaybackIfUnlocked);
      videoElement.addEventListener("canplay", retryUnmutedPlaybackIfUnlocked);
      cleanupVideoHandlers = () => {
        videoElement.removeEventListener("error", handleVideoError);
        videoElement.removeEventListener(
          "loadedmetadata",
          retryUnmutedPlaybackIfUnlocked,
        );
        videoElement.removeEventListener("canplay", retryUnmutedPlaybackIfUnlocked);
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
      cleanupAudioHandlers?.();
    };
  }, [mediaUrl, sessionKey, transcriptSyncKey, useLocalAssetFallback]);

  return activeTexture;
};
