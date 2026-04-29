"use client";

import { useEffect, useMemo, useState } from "react";

export type CanvasViewMode = "sphere" | "orb" | "orb3d" | "equirect";

export type OverlayLayoutSettings = {
  mapRight: number;
  mapVertical: number;
  transcriptRight: number;
  transcriptVertical: number;
  transcriptCenterOffset: number;
};

const DEFAULT_OVERLAY_LAYOUT_SETTINGS: OverlayLayoutSettings = {
  mapRight: -50,
  mapVertical: 8,
  transcriptRight: -35,
  transcriptVertical: 0,
  transcriptCenterOffset: -30,
};

export const useModelCanvasModes = ({
  pathname,
  isRestrictedUiAllowed,
  hasSecondaryCanvas,
}: {
  pathname: string;
  isRestrictedUiAllowed: boolean;
  hasSecondaryCanvas: boolean;
}) => {
  const [viewMode, setViewMode] = useState<CanvasViewMode>("sphere");
  const [overlayLayoutSettings, setOverlayLayoutSettings] =
    useState<OverlayLayoutSettings>(DEFAULT_OVERLAY_LAYOUT_SETTINGS);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    if (
      isRestrictedUiAllowed &&
      (view === "orb" || view === "orb3d" || view === "equirect")
    ) {
      setViewMode(view);
      return;
    }

    setViewMode("sphere");
  }, [isRestrictedUiAllowed, pathname]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const isOrbOverlayMode = viewMode === "orb" || viewMode === "orb3d";
    const effectiveMapRight = isOrbOverlayMode
      ? overlayLayoutSettings.mapRight
      : 0;
    root.style.setProperty("--overlay-map-right", `${effectiveMapRight}px`);
    root.style.setProperty(
      "--overlay-map-vertical",
      `${overlayLayoutSettings.mapVertical}px`,
    );
    root.style.setProperty(
      "--overlay-transcript-right",
      `${overlayLayoutSettings.transcriptRight}px`,
    );
    root.style.setProperty(
      "--overlay-transcript-vertical",
      `${overlayLayoutSettings.transcriptVertical}px`,
    );
    root.style.setProperty(
      "--overlay-transcript-center-offset",
      `${overlayLayoutSettings.transcriptCenterOffset}px`,
    );
  }, [overlayLayoutSettings, viewMode]);

  return useMemo(() => {
    const isOrbMode = viewMode === "orb";
    const isOrb3DMode = viewMode === "orb3d";
    const isOrbLikeMode = isOrbMode || isOrb3DMode;
    const isEquirectMode = viewMode === "equirect";
    const showOrbUi =
      isRestrictedUiAllowed && isOrbLikeMode && !hasSecondaryCanvas;
    const showEquirectUi =
      isRestrictedUiAllowed && isEquirectMode && !hasSecondaryCanvas;
    const shouldHideSecondaryOrbCanvas =
      isRestrictedUiAllowed &&
      (isOrbLikeMode || isEquirectMode) &&
      hasSecondaryCanvas;

    return {
      viewMode,
      overlayLayoutSettings,
      setOverlayLayoutSettings,
      isOrbMode,
      isOrb3DMode,
      isOrbLikeMode,
      isEquirectMode,
      showOrbUi,
      showEquirectUi,
      shouldHideSecondaryOrbCanvas,
    };
  }, [hasSecondaryCanvas, isRestrictedUiAllowed, overlayLayoutSettings, viewMode]);
};
