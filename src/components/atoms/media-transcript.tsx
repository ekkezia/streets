"use client";

import { CONFIG, ProjectId } from "@/config/config";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type TranscriptDictionary = Record<string, string>;

type MediaTranscriptProps = {
  projectId: ProjectId;
  width?: number | string;
  height?: number;
};

const parseImageKeyFromPathname = (pathname: string): number => {
  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? "1";
  const parsed = Number.parseInt(lastSegment, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const getAudioPath = (projectId: ProjectId, index: number) => {
  const projectConfig = CONFIG[projectId];
  const prefix = projectConfig.mediaPrefixPath ?? projectConfig.supabasePrefixPath;
  return `/assets/audio/${projectConfig.supabaseFolder}/${prefix}_${index}.m4a`;
};

const getTranscriptJsonPath = (projectId: ProjectId) => {
  return `/assets/transcriptions/${CONFIG[projectId].supabaseFolder}.json`;
};

const normalizeTranscriptPayload = (payload: unknown): TranscriptDictionary => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const maybeWithTranscriptions = payload as { transcriptions?: unknown };
  const rawMap =
    maybeWithTranscriptions.transcriptions &&
    typeof maybeWithTranscriptions.transcriptions === "object"
      ? maybeWithTranscriptions.transcriptions
      : payload;

  const nextMap: TranscriptDictionary = {};
  for (const [key, value] of Object.entries(rawMap as Record<string, unknown>)) {
    if (typeof value === "string") {
      nextMap[key] = value;
    }
  }

  return nextMap;
};

const estimateDurationFromText = (text: string) => {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (!wordCount) {
    return 8;
  }

  const wordsPerSecond = 2.6;
  return Math.max(6, Math.min(90, wordCount / wordsPerSecond));
};

const isTouchLandscape = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const hasTouch =
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
    "ontouchstart" in window ||
    window.matchMedia?.("(pointer: coarse)").matches;

  return hasTouch && window.innerWidth >= window.innerHeight;
};

const MediaTranscript: React.FC<MediaTranscriptProps> = ({
  projectId,
  width = "50vw",
  height = 84,
}) => {
  const pathname = usePathname();
  const imageKey = useMemo(() => parseImageKeyFromPathname(pathname), [pathname]);
  const transcriptJsonPath = useMemo(
    () => getTranscriptJsonPath(projectId),
    [projectId],
  );
  const audioUrl = useMemo(() => getAudioPath(projectId, imageKey), [projectId, imageKey]);

  const [isOrbLikeView, setIsOrbLikeView] = useState(false);
  const [isTouchLandscapeOrbView, setIsTouchLandscapeOrbView] = useState(false);
  const [transcriptionMap, setTranscriptionMap] = useState<TranscriptDictionary>({});
  const [audioDurationSeconds, setAudioDurationSeconds] = useState(8);
  const [layoutToken, setLayoutToken] = useState(0);

  const transcriptText = transcriptionMap[String(imageKey)] ?? "";

  const transcriptViewportRef = useRef<HTMLDivElement | null>(null);
  const transcriptTextRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTranscriptions = async () => {
      try {
        const response = await fetch(transcriptJsonPath);
        if (!response.ok) {
          throw new Error(`Failed to load transcription JSON: ${response.status}`);
        }

        const payload = (await response.json()) as unknown;
        if (cancelled) {
          return;
        }

        setTranscriptionMap(normalizeTranscriptPayload(payload));
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Failed to load transcriptions", error);
        setTranscriptionMap({});
      }
    };

    loadTranscriptions();

    return () => {
      cancelled = true;
    };
  }, [transcriptJsonPath]);

  useEffect(() => {
    let cancelled = false;
    const fallbackDuration = estimateDurationFromText(transcriptText);

    const audioElement = document.createElement("audio");
    audioElement.preload = "metadata";

    const finalizeDuration = (durationSeconds: number) => {
      if (cancelled) {
        return;
      }
      setAudioDurationSeconds(Math.max(1, durationSeconds));
    };

    const handleLoadedMetadata = () => {
      const durationSeconds = Number(audioElement.duration);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        finalizeDuration(fallbackDuration);
        return;
      }
      finalizeDuration(durationSeconds);
    };

    const handleError = () => {
      finalizeDuration(fallbackDuration);
    };

    audioElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioElement.addEventListener("error", handleError);
    audioElement.src = audioUrl;
    audioElement.load();

    return () => {
      cancelled = true;
      audioElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audioElement.removeEventListener("error", handleError);
      audioElement.src = "";
      audioElement.load();
    };
  }, [audioUrl, transcriptText]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncViewMode = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      const nextIsOrbLikeView = view === "orb" || view === "orb3d";
      setIsOrbLikeView(nextIsOrbLikeView);
      setIsTouchLandscapeOrbView(nextIsOrbLikeView && isTouchLandscape());
    };

    syncViewMode();
    const intervalId = window.setInterval(syncViewMode, 500);
    window.addEventListener("resize", syncViewMode);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("resize", syncViewMode);
    };
  }, [pathname]);

  useEffect(() => {
    const viewport = transcriptViewportRef.current;
    const text = transcriptTextRef.current;
    if (!viewport || !text || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      setLayoutToken((current) => current + 1);
    });

    observer.observe(viewport);
    observer.observe(text);

    return () => {
      observer.disconnect();
    };
  }, [transcriptText]);

  useEffect(() => {
    const viewport = transcriptViewportRef.current;
    const text = transcriptTextRef.current;
    if (!viewport || !text || !transcriptText.length) {
      return;
    }

    const offsetFromCenter = (viewport.clientWidth + text.scrollWidth) / 2;
    const startX = offsetFromCenter;
    const endX = -offsetFromCenter;
    const animationDurationMs = Math.max(1000, audioDurationSeconds * 1000);

    const animation = text.animate(
      [
        { transform: `translate(calc(-50% + ${startX}px), -50%)` },
        { transform: `translate(calc(-50% + ${endX}px), -50%)` },
      ],
      {
        duration: animationDurationMs,
        easing: "linear",
        fill: "forwards",
      },
    );

    return () => {
      animation.cancel();
    };
  }, [audioDurationSeconds, imageKey, layoutToken, transcriptText]);

  return (
    <div
      className="fixed z-[200] rounded-md border-2 border-white bg-black/75 p-2 text-white shadow-md"
      style={
        isOrbLikeView
          ? {
              top: "calc(50% + var(--overlay-transcript-vertical, 0px))",
              right: isTouchLandscapeOrbView
                ? undefined
                : "var(--overlay-transcript-right, 30px)",
              left: isTouchLandscapeOrbView
                ? "var(--overlay-transcript-right, 30px)"
                : undefined,
              transform: "translateY(-50%) rotate(-90deg)",
              transformOrigin: "center center",
              width: isTouchLandscapeOrbView ? "80vh" : width,
              minHeight: height,
              border: "none",
            }
          : {
              bottom: "var(--overlay-transcript-vertical, 8px)",
              left: "50%",
              transform:
                "translateX(calc(-50% + var(--overlay-transcript-center-offset, 0px)))",
              width,
              minHeight: height,
            }
      }
    >
      <div
        ref={transcriptViewportRef}
        className={`relative flex h-14 items-center justify-center overflow-hidden whitespace-nowrap rounded bg-white/10 px-2 py-1 text-[14px] leading-7 ${
          isOrbLikeView ? "rotate-180" : ""
        }`}
      >
        {transcriptText.length === 0 ? (
          <span className="text-xl text-center text-white/70">
            No transcription for this scene.
          </span>
        ) : (
          <span
            ref={transcriptTextRef}
            className="absolute left-1/2 top-1/2 text-center text-white"
          >
            {transcriptText}
          </span>
        )}
      </div>
    </div>
  );
};

export default MediaTranscript;
