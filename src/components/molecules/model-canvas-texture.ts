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

export const useActiveMediaTexture = (mediaUrl: string) => {
  const [activeTexture, setActiveTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let disposed = false;
    let localVideoElement: HTMLVideoElement | null = null;
    let localTexture: Texture | null = null;
    let pairedAudioController: ReturnType<typeof createPairedAudioController> | null = null;
    const fallbackMediaUrl = getLocalAssetFallbackPath(mediaUrl);

    if (isVideoMediaUrl(mediaUrl)) {
      const videoElement = document.createElement("video");
      videoElement.crossOrigin = "anonymous";
      videoElement.loop = true;
      videoElement.muted = !isAudioUnlockRemembered();
      videoElement.volume = 1;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.setAttribute("playsinline", "true");
      videoElement.setAttribute("webkit-playsinline", "true");
      videoElement.preload = "auto";
      pairedAudioController = createPairedAudioController(videoElement);
      let hasAttemptedFallback = false;
      let audioUnlocked = isAudioUnlockRemembered();
      const unbindPairedAudioVideoEvents = pairedAudioController.bindVideoEvents();

      const attemptPlayback = async (preferUnmuted: boolean) => {
        if (disposed) {
          return false;
        }

        if (preferUnmuted) {
          videoElement.muted = false;
          try {
            await videoElement.play();
            await pairedAudioController?.syncAndPlay();
            audioUnlocked = true;
            rememberAudioUnlock();
            return true;
          } catch {
            // Continue with muted fallback for Safari/iPad autoplay policy.
          }
        }

        videoElement.muted = true;
        audioUnlocked = false;
        pairedAudioController?.pause();
        try {
          await videoElement.play();
        } catch {
          // Keep paused if browser still blocks playback.
        }

        return false;
      };

      const tryUnlockVideoAudio = () => {
        if (disposed) {
          return;
        }

        if (audioUnlocked && !videoElement.muted && !videoElement.paused) {
          return;
        }

        void attemptPlayback(true);
      };

      const handleUserInteractionForAudio = () => {
        tryUnlockVideoAudio();
      };

      const setVideoSource = (nextSource: string) => {
        pairedAudioController?.setSource(nextSource);
        videoElement.src = nextSource;
        videoElement.load();
        void attemptPlayback(audioUnlocked);
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

      const cleanupVideoEvents = () => {
        videoElement.removeEventListener("error", handleVideoError);
        unbindPairedAudioVideoEvents();
        window.removeEventListener("pointerdown", handleUserInteractionForAudio);
        window.removeEventListener("keydown", handleUserInteractionForAudio);
        window.removeEventListener("touchstart", handleUserInteractionForAudio);
      };

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

      pairedAudioController?.dispose();
    };
  }, [mediaUrl]);

  return activeTexture;
};
