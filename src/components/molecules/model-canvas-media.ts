import { SUPABASE_URL } from "@/config/config";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogv", ".ogg"];
const AUDIO_EXTENSION = ".m4a";
const AUDIO_UNLOCK_SESSION_KEY = "streets_audio_unlocked";
const VIDEO_VOLUME_WITH_PAIRED_AUDIO = 0.35;
const PAIRED_AUDIO_SYNC_DRIFT_SECONDS = 0.2;

declare global {
  interface Window {
    __streetsAudioUnlocked?: boolean;
  }
}

const stripQueryAndHash = (url: string) => url.split("#")[0].split("?")[0];

export const isVideoMediaUrl = (url: string) => {
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

export const isAudioUnlockRemembered = () => {
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

export const rememberAudioUnlock = () => {
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

export const getLocalAssetFallbackPath = (mediaUrl: string) => {
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

    console.log(
      "Media URL failed to load, falling back to local asset if available:",
      `assets/${relativePath}`,
    );

    return `/assets/images/${relativePath}`;
  } catch {
    return null;
  }
};

const replacePathExtension = (path: string, extension: string) => {
  const lastSlashIdx = path.lastIndexOf("/");
  const lastDotIdx = path.lastIndexOf(".");
  if (lastDotIdx === -1 || lastDotIdx < lastSlashIdx) {
    return `${path}${extension}`;
  }

  return `${path.slice(0, lastDotIdx)}${extension}`;
};

export const getPairedAudioPath = (videoUrl: string) => {
  if (!videoUrl || videoUrl.startsWith("data:") || videoUrl.startsWith("blob:")) {
    return null;
  }

  try {
    const videoPath = new URL(videoUrl, "http://localhost").pathname.replace(/\/+$/, "");
    if (!videoPath.length) {
      return null;
    }

    const normalizedVideoPath = videoPath.toLowerCase();
    const hasVideoExtension = VIDEO_EXTENSIONS.some((extension) =>
      normalizedVideoPath.endsWith(extension),
    );
    if (!hasVideoExtension) {
      return null;
    }

    if (videoPath.startsWith("/assets/images/")) {
      const relativePath = videoPath.slice("/assets/images/".length);
      return `/assets/audio/${replacePathExtension(relativePath, AUDIO_EXTENSION)}`;
    }

    const supabasePublicPath = new URL(SUPABASE_URL).pathname.replace(/\/+$/, "");
    if (videoPath.startsWith(`${supabasePublicPath}/`)) {
      const relativePath = videoPath.slice(supabasePublicPath.length + 1);
      return `/assets/audio/${replacePathExtension(relativePath, AUDIO_EXTENSION)}`;
    }

    return null;
  } catch {
    return null;
  }
};

export const createPairedAudioController = (videoElement: HTMLVideoElement) => {
  const pairedAudioElement = document.createElement("audio");
  pairedAudioElement.crossOrigin = "anonymous";
  pairedAudioElement.loop = true;
  pairedAudioElement.preload = "auto";

  const pause = () => {
    pairedAudioElement.pause();
  };

  const syncTime = () => {
    if (
      !Number.isFinite(videoElement.currentTime) ||
      !Number.isFinite(pairedAudioElement.currentTime)
    ) {
      return;
    }

    if (
      Math.abs(pairedAudioElement.currentTime - videoElement.currentTime) >
      PAIRED_AUDIO_SYNC_DRIFT_SECONDS
    ) {
      pairedAudioElement.currentTime = videoElement.currentTime;
    }
  };

  const syncRate = () => {
    pairedAudioElement.playbackRate = videoElement.playbackRate;
  };

  const syncAndPlay = async () => {
    if (!pairedAudioElement.src || videoElement.muted || videoElement.paused) {
      pause();
      return;
    }

    pairedAudioElement.muted = false;
    syncRate();
    syncTime();

    try {
      await pairedAudioElement.play();
    } catch {
      // Ignore autoplay failures for auxiliary audio.
    }
  };

  const setSource = (videoSource: string) => {
    const pairedAudioSource = getPairedAudioPath(videoSource);
    if (pairedAudioSource) {
      videoElement.volume = VIDEO_VOLUME_WITH_PAIRED_AUDIO;
      if (pairedAudioElement.src !== pairedAudioSource) {
        pairedAudioElement.src = pairedAudioSource;
        pairedAudioElement.load();
      }
      return true;
    }

    videoElement.volume = 1;
    pause();
    pairedAudioElement.removeAttribute("src");
    pairedAudioElement.load();
    return false;
  };

  const handleVideoPlay = () => {
    void syncAndPlay();
  };

  const bindVideoEvents = () => {
    videoElement.addEventListener("play", handleVideoPlay);
    videoElement.addEventListener("pause", pause);
    videoElement.addEventListener("seeking", syncTime);
    videoElement.addEventListener("timeupdate", syncTime);
    videoElement.addEventListener("ratechange", syncRate);

    return () => {
      videoElement.removeEventListener("play", handleVideoPlay);
      videoElement.removeEventListener("pause", pause);
      videoElement.removeEventListener("seeking", syncTime);
      videoElement.removeEventListener("timeupdate", syncTime);
      videoElement.removeEventListener("ratechange", syncRate);
    };
  };

  const dispose = () => {
    pause();
    pairedAudioElement.src = "";
    pairedAudioElement.load();
  };

  return {
    bindVideoEvents,
    dispose,
    pause,
    setSource,
    syncAndPlay,
  };
};
