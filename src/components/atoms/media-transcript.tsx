"use client";

import { CONFIG, ProjectId } from "@/config/config";
import { usePathname } from "next/navigation";
import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isVideoMediaUrl } from "../molecules/model-canvas-media";

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

const getTranscriptJsonPath = (projectId: ProjectId) => {
  return `/assets/transcriptions/${CONFIG[projectId].supabaseFolder}.json`;
};
const MEDIA_TRANSCRIPT_SYNC_EVENT = "streets-media-transcript-sync";
const OVERLAY_LAYOUT_CHANGE_EVENT = "streets-overlay-layout-change";

const isVideoScene = (projectId: ProjectId, index: number) => {
  const projectConfig = CONFIG[projectId];
  const indexedMedia = projectConfig.mediaByIndex?.[index];
  if (indexedMedia) {
    return isVideoMediaUrl(indexedMedia);
  }

  const extension = projectConfig.supabaseMediaExtension ?? "jpg";
  const prefix = projectConfig.mediaPrefixPath ?? projectConfig.supabasePrefixPath;
  return isVideoMediaUrl(`${prefix}_${index}.${extension}`);
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

const detectTouchDevice = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
    "ontouchstart" in window ||
    window.matchMedia?.("(pointer: coarse)").matches
  );
};

const parseCssVarPx = (name: string, fallback: number) => {
  if (typeof window === "undefined") {
    return fallback;
  }

  const rawValue = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const numericValue = Number.parseFloat(rawValue);
  return Number.isFinite(numericValue) ? numericValue : fallback;
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

  const [isOrbLikeView, setIsOrbLikeView] = useState(false);
  const [isTouchLandscapeOrbView, setIsTouchLandscapeOrbView] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [overlayPositionEditEnabled, setOverlayPositionEditEnabled] =
    useState(false);
  const [transcriptionMap, setTranscriptionMap] = useState<TranscriptDictionary>({});
  const [layoutToken, setLayoutToken] = useState(0);
  const [transcriptSyncTick, setTranscriptSyncTick] = useState(0);

  const transcriptText = transcriptionMap[String(imageKey)] ?? "";
  const audioDurationSeconds = useMemo(
    () => estimateDurationFromText(transcriptText),
    [transcriptText],
  );
  const shouldLoopWithMedia = useMemo(
    () => isVideoScene(projectId, imageKey),
    [imageKey, projectId],
  );
  const transcriptSyncKey = useMemo(
    () => `${projectId}:${imageKey}`,
    [imageKey, projectId],
  );

  const transcriptViewportRef = useRef<HTMLDivElement | null>(null);
  const transcriptTextRef = useRef<HTMLSpanElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRight: number;
    startVertical: number;
  } | null>(null);

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
    if (typeof window === "undefined") {
      return;
    }

    const syncViewMode = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      const nextIsOrbLikeView = view === "orb" || view === "orb3d";
      setIsOrbLikeView(nextIsOrbLikeView);
      setIsTouchLandscapeOrbView(nextIsOrbLikeView && isTouchLandscape());
      setIsTouchDevice(detectTouchDevice());
      setOverlayPositionEditEnabled(
        parseCssVarPx("--overlay-position-edit-enabled", 0) > 0.5,
      );
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
    if (typeof window === "undefined") {
      return;
    }

    const handleOverlayEditEvent = () => {
      setOverlayPositionEditEnabled(
        parseCssVarPx("--overlay-position-edit-enabled", 0) > 0.5,
      );
    };

    window.addEventListener(
      "streets-overlay-position-edit-mode-change",
      handleOverlayEditEvent,
    );

    return () => {
      window.removeEventListener(
        "streets-overlay-position-edit-mode-change",
        handleOverlayEditEvent,
      );
    };
  }, []);

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

    if (shouldLoopWithMedia && transcriptSyncTick === 0) {
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
        iterations: 1,
      },
    );

    return () => {
      animation.cancel();
    };
  }, [
    audioDurationSeconds,
    imageKey,
    layoutToken,
    shouldLoopWithMedia,
    transcriptSyncTick,
    transcriptText,
  ]);

  useEffect(() => {
    setTranscriptSyncTick(0);
  }, [transcriptSyncKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !shouldLoopWithMedia) {
      return;
    }

    const handleTranscriptSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>;
      if (customEvent.detail?.key !== transcriptSyncKey) {
        return;
      }

      setTranscriptSyncTick((current) => current + 1);
    };

    window.addEventListener(
      MEDIA_TRANSCRIPT_SYNC_EVENT,
      handleTranscriptSync as EventListener,
    );

    return () => {
      window.removeEventListener(
        MEDIA_TRANSCRIPT_SYNC_EVENT,
        handleTranscriptSync as EventListener,
      );
    };
  }, [shouldLoopWithMedia, transcriptSyncKey]);

  const canDragTranscriptPosition =
    isOrbLikeView && isTouchDevice && overlayPositionEditEnabled;

  const updateTranscriptOverlayPosition = useCallback(
    (right: number, vertical: number) => {
      if (typeof window === "undefined") {
        return;
      }

      const root = document.documentElement;
      root.style.setProperty("--overlay-transcript-right", `${right}px`);
      root.style.setProperty("--overlay-transcript-vertical", `${vertical}px`);
      window.dispatchEvent(
        new CustomEvent(OVERLAY_LAYOUT_CHANGE_EVENT, {
          detail: {
            transcriptRight: right,
            transcriptVertical: vertical,
          },
        }),
      );
    },
    [],
  );

  const handleTranscriptDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!canDragTranscriptPosition) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const startRight = parseCssVarPx("--overlay-transcript-right", 30);
      const startVertical = parseCssVarPx("--overlay-transcript-vertical", 0);
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startRight,
        startVertical,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [canDragTranscriptPosition],
  );

  const handleTranscriptDragMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      const nextRight = isTouchLandscapeOrbView
        ? dragState.startRight + deltaX
        : dragState.startRight - deltaX;
      const nextVertical = dragState.startVertical + deltaY;
      updateTranscriptOverlayPosition(nextRight, nextVertical);
    },
    [isTouchLandscapeOrbView, updateTranscriptOverlayPosition],
  );

  const handleTranscriptDragEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      dragStateRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  return (
    <div
      className="fixed z-[200]"
      onPointerDown={handleTranscriptDragStart}
      onPointerMove={handleTranscriptDragMove}
      onPointerUp={handleTranscriptDragEnd}
      onPointerCancel={handleTranscriptDragEnd}
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
              width: isTouchLandscapeOrbView ? "82vh" : width,
              touchAction: canDragTranscriptPosition ? "none" : "auto",
            }
          : {
              bottom: "var(--overlay-transcript-vertical, 8px)",
              left: "50%",
              transform:
                "translateX(calc(-50% + var(--overlay-transcript-center-offset, 0px)))",
              width,
              minHeight: height,
              touchAction: canDragTranscriptPosition ? "none" : "auto",
            }
      }
    >
      <div
        ref={transcriptViewportRef}
        className={
          `
          border-2 border-white/50 bg-gray-900/70
          rounded-md relative flex h-16 items-center justify-center overflow-hidden whitespace-nowrap rounded bg-white/10 px-2 py-1 leading-7 ${
          isOrbLikeView ? "rotate-0" : ""
        } ${canDragTranscriptPosition ? "border-cyan-300/80 bg-cyan-300/10" : ""}`}
      >
        {transcriptText.length === 0 ? (
          <span className="text-xl text-center text-white/70">
            No transcription for this scene.
          </span>
        ) : (
          <span
            ref={transcriptTextRef}
            className="text-xl absolute left-1/2 top-1/2 text-center text-white"
          >
            {transcriptText}
          </span>
        )}
      </div>
    </div>
  );
};

export default MediaTranscript;
