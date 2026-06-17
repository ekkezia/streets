"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  stop: () => void;
  audioUnlocked: boolean;
  transcriptSyncKey?: string;
};

const sharedVideoSessions = new Map<string, SharedVideoSession>();
const activeVideoSessionKeys = new Set<string>();
let globalAudioUnlockListenersBound = false;
const MEDIA_TRANSCRIPT_SYNC_EVENT = "streets-media-transcript-sync";
const TEXTURE_DISPOSE_AFTER_TRANSITION_MS = 900;

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

    sharedVideoSessions.forEach((session, sessionKey) => {
      if (!activeVideoSessionKeys.has(sessionKey)) {
        return;
      }

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

  const resumeAllSessionsIfVisible = () => {
    if (typeof document !== "undefined" && document.hidden) {
      return;
    }

    sharedVideoSessions.forEach((session, sessionKey) => {
      if (!activeVideoSessionKeys.has(sessionKey)) {
        return;
      }

      const target = session.videoElement;
      const shouldPreferUnmuted =
        session.audioUnlocked || isAudioUnlockRemembered();
      target.muted = !shouldPreferUnmuted;
      void target.play().catch(() => {
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
  document.addEventListener("visibilitychange", resumeAllSessionsIfVisible);
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
  videoElement.disablePictureInPicture = true;
  videoElement.style.position = "fixed";
  videoElement.style.left = "0";
  videoElement.style.top = "0";
  videoElement.style.width = "1px";
  videoElement.style.height = "1px";
  videoElement.style.opacity = "0";
  videoElement.style.pointerEvents = "none";
  videoElement.style.zIndex = "-1";
  videoElement.setAttribute("aria-hidden", "true");
  document.body.appendChild(videoElement);

  const videoTexture = new VideoTexture(videoElement);
  videoTexture.colorSpace = SRGBColorSpace;
  videoTexture.minFilter = LinearFilter;
  videoTexture.magFilter = LinearFilter;
  videoTexture.generateMipmaps = false;

  const stop = () => {
    videoElement.pause();
    videoElement.muted = true;
    videoElement.removeAttribute("src");
    videoElement.load();
    videoElement.remove();
  };

  const nextSession: SharedVideoSession = {
    videoElement,
    videoTexture,
    stop,
    audioUnlocked: isAudioUnlockRemembered(),
    transcriptSyncKey: undefined,
  };

  sharedVideoSessions.set(sessionKey, nextSession);
  bindGlobalAudioUnlockListeners();
  return nextSession;
};

const stopSharedVideoSession = (sessionKey: string) => {
  const session = sharedVideoSessions.get(sessionKey);
  if (!session) {
    return;
  }

  session.stop();
  sharedVideoSessions.delete(sessionKey);
};

export const useActiveMediaTexture = (
  mediaUrl: string,
  useLocalAssetFallback = false,
  sessionKey = "default",
  transcriptSyncKey?: string,
) => {
  const [activeTexture, setActiveTexture] = useState<Texture | null>(null);
  const activeTextureRef = useRef<Texture | null>(null);
  const ownedImageTexturesRef = useRef(new Set<Texture>());
  const disposeTimeoutsRef = useRef<number[]>([]);

  const disposeOwnedTexture = useCallback((texture: Texture) => {
    if (!ownedImageTexturesRef.current.has(texture)) {
      return;
    }

    ownedImageTexturesRef.current.delete(texture);
    texture.dispose();
  }, []);

  const scheduleOwnedTextureDisposal = useCallback((texture: Texture) => {
    if (!ownedImageTexturesRef.current.has(texture)) {
      return;
    }

    if (typeof window === "undefined") {
      disposeOwnedTexture(texture);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (activeTextureRef.current !== texture) {
        disposeOwnedTexture(texture);
      }
    }, TEXTURE_DISPOSE_AFTER_TRANSITION_MS);
    disposeTimeoutsRef.current.push(timeoutId);
  }, [disposeOwnedTexture]);

  const setDisplayedTexture = useCallback((texture: Texture | null) => {
    const previousTexture = activeTextureRef.current;
    if (previousTexture && previousTexture !== texture) {
      scheduleOwnedTextureDisposal(previousTexture);
    }

    activeTextureRef.current = texture;
    setActiveTexture(texture);
  }, [scheduleOwnedTextureDisposal]);

  useEffect(
    () => () => {
      disposeTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      ownedImageTexturesRef.current.forEach((texture) => {
        texture.dispose();
      });
      ownedImageTexturesRef.current.clear();
    },
    [disposeOwnedTexture],
  );

  useEffect(() => {
    let disposed = false;
    let localTexture: Texture | null = null;
    let cleanupVideoHandlers: (() => void) | null = null;
    let cleanupTranscriptHandlers: (() => void) | null = null;
    const fallbackMediaUrl = useLocalAssetFallback
      ? getLocalAssetFallbackPath(mediaUrl)
      : null;

    if (isVideoMediaUrl(mediaUrl)) {
      const videoSessionKey = `${sessionKey}:${mediaUrl}`;
      const session = getOrCreateSharedVideoSession(videoSessionKey);
      const videoElement = session.videoElement;
      let hasAttemptedFallback = false;
      let hasDispatchedInitialTranscriptSync = false;
      let previousVideoTime = videoElement.currentTime;
      activeVideoSessionKeys.add(videoSessionKey);
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

      const displayVideoWhenReady = () => {
        if (disposed) {
          return;
        }

        if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          return;
        }

        session.videoTexture.needsUpdate = true;
        ownedImageTexturesRef.current.add(session.videoTexture);
        setDisplayedTexture(session.videoTexture);
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

        if (process.env.NODE_ENV !== "production") {
          console.warn("Failed to load video media", {
            mediaUrl,
            code: videoElement.error?.code,
            message: videoElement.error?.message,
          });
        }

        if (!activeTextureRef.current) {
          setDisplayedTexture(null);
        }
      };

      videoElement.addEventListener("error", handleVideoError);
      videoElement.addEventListener("loadeddata", displayVideoWhenReady);
      videoElement.addEventListener("canplay", displayVideoWhenReady);
      videoElement.addEventListener("loadedmetadata", retryPlaybackWhenReady);
      videoElement.addEventListener("canplay", retryPlaybackWhenReady);
      cleanupVideoHandlers = () => {
        videoElement.removeEventListener("error", handleVideoError);
        videoElement.removeEventListener("loadeddata", displayVideoWhenReady);
        videoElement.removeEventListener("canplay", displayVideoWhenReady);
        videoElement.removeEventListener(
          "loadedmetadata",
          retryPlaybackWhenReady,
        );
        videoElement.removeEventListener("canplay", retryPlaybackWhenReady);
      };

      setVideoSource(mediaUrl);
      if (videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        displayVideoWhenReady();
      }
    } else {
      stopSharedVideoSession(sessionKey);

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
            ownedImageTexturesRef.current.add(texture);
            setDisplayedTexture(texture);
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

            if (!activeTextureRef.current) {
              setDisplayedTexture(null);
            }
          },
        );
      };

      loadTexture(mediaUrl);
    }

    return () => {
      disposed = true;

      if (localTexture && activeTextureRef.current !== localTexture) {
        disposeOwnedTexture(localTexture);
      }

      cleanupVideoHandlers?.();
      cleanupTranscriptHandlers?.();

      if (isVideoMediaUrl(mediaUrl)) {
        const videoSessionKey = `${sessionKey}:${mediaUrl}`;
        activeVideoSessionKeys.delete(videoSessionKey);
        stopSharedVideoSession(videoSessionKey);
      }
    };
  }, [
    disposeOwnedTexture,
    mediaUrl,
    sessionKey,
    setDisplayedTexture,
    transcriptSyncKey,
    useLocalAssetFallback,
  ]);

  return activeTexture;
};
