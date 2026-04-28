"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDirection } from "../atoms/model-arrow";
import { DirectionTuple } from "@/config/config";
import {
  createPairedAudioController,
  getLocalAssetFallbackPath,
  isAudioUnlockRemembered,
  rememberAudioUnlock,
} from "./model-canvas-media";

type EquirectangularViewProps = {
  mediaUrl: string;
  isVideo: boolean;
  currentMoves: DirectionTuple[];
  onMove: (value: number) => void;
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

const EquirectangularView: React.FC<EquirectangularViewProps> = ({
  mediaUrl,
  isVideo,
  currentMoves,
  onMove,
}) => {
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

    const target = videoRef.current;
    if (!target) {
      return;
    }

    const pairedAudioController = createPairedAudioController(target);
    const unbindPairedAudioVideoEvents = pairedAudioController.bindVideoEvents();

    const attemptPlayback = async (preferUnmuted: boolean) => {
      if (preferUnmuted) {
        target.muted = false;
        setVideoMuted(false);
        try {
          await target.play();
          await pairedAudioController.syncAndPlay();
          setVideoMuted(false);
          rememberAudioUnlock();
          return true;
        } catch {
          // Continue with muted fallback for Safari/iPad autoplay policy.
        }
      }

      target.muted = true;
      setVideoMuted(true);
      pairedAudioController.pause();
      try {
        await target.play();
      } catch {
        // Keep paused if browser still blocks playback.
      }

      return false;
    };

    const unlockAudio = () => {
      if (!target.paused && !target.muted) {
        return;
      }

      void attemptPlayback(true);
    };

    const syncInlinePlaybackAttributes = () => {
      target.setAttribute("playsinline", "true");
      target.setAttribute("webkit-playsinline", "true");
    };

    const tryStartPlayback = () => {
      void attemptPlayback(isAudioUnlockRemembered());
    };

    syncInlinePlaybackAttributes();
    pairedAudioController.setSource(resolvedMediaUrl);
    tryStartPlayback();
    target.addEventListener("loadedmetadata", tryStartPlayback);
    target.addEventListener("canplay", tryStartPlayback);

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);

    return () => {
      target.removeEventListener("loadedmetadata", tryStartPlayback);
      target.removeEventListener("canplay", tryStartPlayback);
      unbindPairedAudioVideoEvents();
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
      pairedAudioController.dispose();
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

export default EquirectangularView;
