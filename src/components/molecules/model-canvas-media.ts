import { SUPABASE_URL } from "@/config/config";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogv", ".ogg"];
const AUDIO_UNLOCK_SESSION_KEY = "streets_audio_unlocked";

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

    return `/assets/images/${relativePath}`;
  } catch {
    return null;
  }
};
