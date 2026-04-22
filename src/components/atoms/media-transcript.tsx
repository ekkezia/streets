"use client";

import { CONFIG, ProjectId, SUPABASE_URL } from "@/config/config";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: (track?: MediaStreamTrack) => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

type TranscriptStatus =
  | "idle"
  | "loading"
  | "listening"
  | "unsupported"
  | "no-video"
  | "no-audio-track"
  | "error";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogv", ".ogg"];

const stripQueryAndHash = (url: string) => url.split("#")[0].split("?")[0];

const isVideoMediaUrl = (url: string) => {
  const normalizedUrl = stripQueryAndHash(url).toLowerCase();
  return VIDEO_EXTENSIONS.some((extension) => normalizedUrl.endsWith(extension));
};

const parseImageKeyFromPathname = (pathname: string): number => {
  const parsed = Number.parseInt(pathname.split("/").filter(Boolean)[1] ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const getMediaPath = (projectId: ProjectId, index: number) => {
  const projectConfig = CONFIG[projectId];
  const perIndexMedia = projectConfig.mediaByIndex?.[index];
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
    index +
    "." +
    extension
  );
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

    return `/assets/${relativePath}`;
  } catch {
    return null;
  }
};

const trimWordsToMaxChars = (words: string[], maxChars: number) => {
  if (maxChars <= 0) {
    return [];
  }

  const nextWords = words.filter(Boolean);
  while (nextWords.length && nextWords.join(" ").length > maxChars) {
    nextWords.shift();
  }

  return nextWords;
};

const MediaTranscript: React.FC<{
  projectId: ProjectId;
  width?: number | string;
  height?: number;
  maxWords?: number;
  language?: string;
}> = ({
  projectId,
  width = "50vw",
  height = 'fit-content',
  maxWords = 10,
  language = "en-US",
}) => {
  const pathname = usePathname();
  const imageKey = useMemo(() => parseImageKeyFromPathname(pathname), [pathname]);
  const mediaUrl = useMemo(() => getMediaPath(projectId, imageKey), [projectId, imageKey]);

  const [status, setStatus] = useState<TranscriptStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [finalWords, setFinalWords] = useState<string[]>([]);
  const [interimWords, setInterimWords] = useState<string[]>([]);
  const [restartToken, setRestartToken] = useState(0);
  const [maxVisibleChars, setMaxVisibleChars] = useState(240);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shouldRunRef = useRef(true);
  const transcriptViewportRef = useRef<HTMLDivElement | null>(null);
  const maxVisibleCharsRef = useRef(maxVisibleChars);

  useEffect(() => {
    maxVisibleCharsRef.current = maxVisibleChars;
    setFinalWords((current) => trimWordsToMaxChars(current, maxVisibleChars));
    setInterimWords((current) => trimWordsToMaxChars(current, maxVisibleChars));
  }, [maxVisibleChars]);

  useEffect(() => {
    setFinalWords([]);
    setInterimWords([]);
  }, [imageKey, projectId]);

  useEffect(() => {
    const viewport = transcriptViewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateMaxVisibleChars = () => {
      const charsPerLine = Math.max(22, Math.floor(viewport.clientWidth / 7));
      setMaxVisibleChars(charsPerLine);
    };

    updateMaxVisibleChars();
    const observer = new ResizeObserver(updateMaxVisibleChars);
    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    shouldRunRef.current = true;

    const cleanup = () => {
      shouldRunRef.current = false;

      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore stop failures.
        }
        recognitionRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
        videoRef.current.load();
        videoRef.current = null;
      }
    };

    if (!isVideoMediaUrl(mediaUrl)) {
      setStatus("no-video");
      setErrorMessage(null);
      cleanup();
      return cleanup;
    }

    const RecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      setStatus("unsupported");
      setErrorMessage("Speech recognition is not available in this browser.");
      cleanup();
      return cleanup;
    }

    let disposed = false;

    const startRecognition = (track: MediaStreamTrack, recognition: SpeechRecognitionLike) => {
      if (!shouldRunRef.current || disposed) {
        return;
      }

      try {
        recognition.start(track);
        setStatus("listening");
      } catch (error) {
        setStatus("unsupported");
        setErrorMessage(
          "This browser cannot transcribe directly from a video audio track.",
        );
        console.error("SpeechRecognition track start failed", error);
      }
    };

    const loadVideoSource = (video: HTMLVideoElement, source: string) =>
      new Promise<boolean>((resolve) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(false);
        }, 8000);

        const cleanupListeners = () => {
          window.clearTimeout(timeoutId);
          video.removeEventListener("loadedmetadata", handleLoadedMetadata);
          video.removeEventListener("error", handleError);
        };

        const handleLoadedMetadata = () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanupListeners();
          resolve(true);
        };

        const handleError = () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanupListeners();
          resolve(false);
        };

        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        video.addEventListener("error", handleError);

        video.src = source;
        video.load();
      });

    const waitForAudioTrack = (stream: MediaStream, timeoutMs = 3000) =>
      new Promise<MediaStreamTrack | null>((resolve) => {
        const immediateTrack = stream.getAudioTracks()[0];
        if (immediateTrack) {
          resolve(immediateTrack);
          return;
        }

        let settled = false;
        const timeoutId = window.setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          stream.removeEventListener("addtrack", handleAddTrack);
          resolve(null);
        }, timeoutMs);

        const handleAddTrack = (event: Event) => {
          const track = (event as MediaStreamTrackEvent).track;
          if (!track || track.kind !== "audio" || settled) {
            return;
          }

          settled = true;
          window.clearTimeout(timeoutId);
          stream.removeEventListener("addtrack", handleAddTrack);
          resolve(track);
        };

        stream.addEventListener("addtrack", handleAddTrack);
      });

    const init = async () => {
      setStatus("loading");
      setErrorMessage(null);

      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.playsInline = true;
      video.muted = true;
      video.loop = true;
      video.preload = "auto";
      videoRef.current = video;

      const fallbackMediaUrl = getLocalAssetFallbackPath(mediaUrl);
      const candidateSources = [mediaUrl, fallbackMediaUrl]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .filter((value, index, all) => all.indexOf(value) === index);

      const captureVideo = video as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };

      const getTrackFromSource = async (source: string) => {
        if (!shouldRunRef.current || disposed) {
          return null;
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const loaded = await loadVideoSource(video, source);
        if (!loaded || !shouldRunRef.current || disposed) {
          return null;
        }

        try {
          await video.play();
        } catch {
          // Keep trying; captureStream may still expose tracks after metadata load.
        }

        const stream =
          captureVideo.captureStream?.() ?? captureVideo.mozCaptureStream?.();
        if (!stream) {
          setStatus("unsupported");
          setErrorMessage("Media stream capture is unavailable in this browser.");
          return null;
        }

        streamRef.current = stream;
        return waitForAudioTrack(stream, 3500);
      };

      let audioTrack: MediaStreamTrack | null = null;
      for (const source of candidateSources) {
        audioTrack = await getTrackFromSource(source);
        if (audioTrack) {
          break;
        }
      }

      if (!audioTrack) {
        setStatus("no-audio-track");
        setErrorMessage(
          "No audio track detected from remote media or local fallback.",
        );
        return;
      }

      const recognition = new RecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event: any) => {
        if (!shouldRunRef.current || disposed) {
          return;
        }

        let nextInterimWords: string[] = [];

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result?.[0]?.transcript?.trim() ?? "";
          if (!transcript) {
            continue;
          }

          const words = transcript.split(/\s+/).filter(Boolean);
          if (!words.length) {
            continue;
          }

          if (result.isFinal) {
            setFinalWords((current) => {
              const withWordCap = [...current, ...words].slice(-maxWords);
              return trimWordsToMaxChars(
                withWordCap,
                maxVisibleCharsRef.current,
              );
            });
            nextInterimWords = [];
          } else {
            nextInterimWords = words;
          }
        }

        setInterimWords(
          trimWordsToMaxChars(nextInterimWords, maxVisibleCharsRef.current),
        );
      };

      recognition.onerror = (event: any) => {
        if (!shouldRunRef.current || disposed) {
          return;
        }

        setStatus("error");
        setErrorMessage(event?.error ? `Recognition error: ${event.error}` : "Recognition error");
      };

      recognition.onend = () => {
        if (!shouldRunRef.current || disposed) {
          return;
        }

        startRecognition(audioTrack, recognition);
      };

      recognitionRef.current = recognition;
      startRecognition(audioTrack, recognition);
    };

    init();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [language, maxWords, mediaUrl, restartToken]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "loading":
        return "Initializing";
      case "listening":
        return "Listening";
      case "unsupported":
        return "Unsupported";
      case "no-video":
        return "No Video";
      case "no-audio-track":
        return "No Audio Track";
      case "error":
        return "Error";
      default:
        return "Idle";
    }
  }, [status]);

  const displayWords = useMemo(
    () => trimWordsToMaxChars([...finalWords, ...interimWords], maxVisibleChars),
    [finalWords, interimWords, maxVisibleChars],
  );

  return (
    <div
      className="fixed bottom-2 left-1/2 z-[1100] -translate-x-1/2 rounded-md border-2 border-white bg-black/75 p-2 text-white shadow-md"
      style={{ width, minHeight: height }}
    >
      <div
        ref={transcriptViewportRef}
        className="h-9 overflow-hidden whitespace-nowrap rounded bg-white/10 px-2 py-1 text-[14px] leading-7"
      >
        {displayWords.length === 0 && (
          <span className="text-white/70">Waiting for speech...</span>
        )}
        {displayWords.length > 0 && (
          <span className="text-white">{displayWords.join(" ")}</span>
        )}
      </div>

      {errorMessage && <div className="mt-1 text-[10px] text-[#ffd1d1]">{errorMessage}</div>}

      {(status === "unsupported" || status === "error" || status === "no-audio-track") && (
        <button
          className="mt-1 rounded border border-white/40 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white hover:bg-white hover:text-black"
          onClick={() => setRestartToken((current) => current + 1)}
          type="button"
        >
          Retry
        </button>
      )}
    </div>
  );
};

export default MediaTranscript;
