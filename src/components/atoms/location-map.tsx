"use client";

import { CONFIG, ProjectId } from "@/config/config";
import { useLocationContext } from "@/contexts/location-context";
import { usePathname, useRouter } from "next/navigation";
import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import Map, {
  Layer,
  Marker,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";

type LocationPoint = {
  key: number;
  latitude: number;
  longitude: number;
};

type MapClickEvent = {
  lngLat: {
    lng: number;
    lat: number;
  };
};

type MapViewState = {
  latitude: number;
  longitude: number;
  zoom: number;
};

const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ] as string[],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

const CARTO_LIGHT_RASTER_STYLE: StyleSpecification = {
  version: 8 as const,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ] as string[],
      tileSize: 256,
      attribution:
        "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    {
      id: "carto",
      type: "raster",
      source: "carto",
    },
  ],
};
const OVERLAY_LAYOUT_CHANGE_EVENT = "streets-overlay-layout-change";
const OVERLAY_MAP_LABEL_RIGHT_VAR = "--overlay-map-label-right";
const OVERLAY_MAP_LABEL_BOTTOM_VAR = "--overlay-map-label-bottom";
const OVERLAY_MAP_LABEL_RIGHT_OFFSET_VAR = "--overlay-map-label-right-offset";
const OVERLAY_MAP_LABEL_BOTTOM_OFFSET_VAR = "--overlay-map-label-bottom-offset";
const MAP_TILE_SERVICE_WORKER_PATH = "/sw-map-tiles.js";
const TILE_PREFETCH_ZOOM_LEVELS = [15, 16, 17];
const TILE_PREFETCH_MAX_URLS_PER_STYLE = 120;
const TILE_PREFETCH_CONCURRENCY = 8;
const TILE_PREFETCH_PADDING_TILES = 1;

const TILE_TEMPLATE_GROUPS = [
  [
    "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
  ],
  [
    "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  ],
] as const;

const parseImageKeyFromPathname = (pathname: string | null): number | null => {
  if (!pathname) {
    return null;
  }

  const segment = pathname.split("/").filter(Boolean)[1];
  const parsed = Number.parseInt(segment ?? "", 10);

  return Number.isFinite(parsed) ? parsed : null;
};

const formatCoordinate = (value: number) => value.toFixed(6);
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

const lngLatToTile = (longitude: number, latitude: number, zoom: number) => {
  const clampedLat = Math.min(85.05112878, Math.max(-85.05112878, latitude));
  const n = 2 ** zoom;
  const x = Math.floor(((longitude + 180) / 360) * n);
  const latRad = (clampedLat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );

  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
  };
};

const buildPrefetchTileUrls = (
  points: Array<{ latitude: number; longitude: number }>,
) => {
  if (!points.length) {
    return [] as string[];
  }

  const bounds = points.reduce(
    (acc, point) => ({
      minLat: Math.min(acc.minLat, point.latitude),
      maxLat: Math.max(acc.maxLat, point.latitude),
      minLng: Math.min(acc.minLng, point.longitude),
      maxLng: Math.max(acc.maxLng, point.longitude),
    }),
    {
      minLat: points[0].latitude,
      maxLat: points[0].latitude,
      minLng: points[0].longitude,
      maxLng: points[0].longitude,
    },
  );

  const urls = new Set<string>();

  TILE_TEMPLATE_GROUPS.forEach((templates) => {
    let addedForStyle = 0;

    for (const zoom of TILE_PREFETCH_ZOOM_LEVELS) {
      const n = 2 ** zoom;
      const northWest = lngLatToTile(bounds.minLng, bounds.maxLat, zoom);
      const southEast = lngLatToTile(bounds.maxLng, bounds.minLat, zoom);
      const minX = Math.max(0, Math.min(n - 1, northWest.x) - TILE_PREFETCH_PADDING_TILES);
      const maxX = Math.max(0, Math.min(n - 1, southEast.x) + TILE_PREFETCH_PADDING_TILES);
      const minY = Math.max(0, Math.min(n - 1, northWest.y) - TILE_PREFETCH_PADDING_TILES);
      const maxY = Math.max(0, Math.min(n - 1, southEast.y) + TILE_PREFETCH_PADDING_TILES);

      for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
          if (addedForStyle >= TILE_PREFETCH_MAX_URLS_PER_STYLE) {
            break;
          }

          const template = templates[(x + y) % templates.length];
          urls.add(
            template
              .replace("{z}", String(zoom))
              .replace("{x}", String(x))
              .replace("{y}", String(y)),
          );
          addedForStyle += 1;
        }

        if (addedForStyle >= TILE_PREFETCH_MAX_URLS_PER_STYLE) {
          break;
        }
      }

      if (addedForStyle >= TILE_PREFETCH_MAX_URLS_PER_STYLE) {
        break;
      }
    }
  });

  return Array.from(urls);
};

const LocationMap: React.FC<{
  zoom?: number;
  width?: number;
  height?: number;
  projectId: ProjectId;
}> = ({ zoom = 16, width = 220, height = 160, projectId }) => {
  const { position, setPosition } = useLocationContext();
  const pathname = usePathname();
  const router = useRouter();
  const [hoveredKey, setHoveredKey] = useState<number | null>(null);
  const [isOrbLikeView, setIsOrbLikeView] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [overlayPositionEditEnabled, setOverlayPositionEditEnabled] =
    useState(false);
  const [mapViewState, setMapViewState] = useState<MapViewState>({
    latitude: 0,
    longitude: 0,
    zoom,
  });
  const [useFallbackMapStyle, setUseFallbackMapStyle] = useState(false);
  const [tileLoadWarning, setTileLoadWarning] = useState(false);
  const [overlayLayoutTick, setOverlayLayoutTick] = useState(0);
  const mapRef = useRef<MapRef | null>(null);
  const hasRegisteredTileSwRef = useRef(false);
  const prefetchedTileAreaKeysRef = useRef<Set<string>>(new Set());
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRight: number;
    startVertical: number;
  } | null>(null);
  const labelDragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncViewMode = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      const nextIsOrbLikeView = view === "orb" || view === "orb3d";
      setIsOrbLikeView(nextIsOrbLikeView);
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
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      hasRegisteredTileSwRef.current
    ) {
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      return;
    }

    hasRegisteredTileSwRef.current = true;
    void navigator.serviceWorker
      .register(MAP_TILE_SERVICE_WORKER_PATH, {
        scope: "/",
        updateViaCache: "none",
      })
      .catch(() => {
        // Ignore SW registration failures and rely on default HTTP cache.
      });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOverlayLayoutChange = () => {
      setOverlayLayoutTick((current) => current + 1);
    };

    window.addEventListener(
      OVERLAY_LAYOUT_CHANGE_EVENT,
      handleOverlayLayoutChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        OVERLAY_LAYOUT_CHANGE_EVENT,
        handleOverlayLayoutChange as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncOverlayEditMode = () => {
      setOverlayPositionEditEnabled(
        parseCssVarPx("--overlay-position-edit-enabled", 0) > 0.5,
      );
    };

    const handleOverlayEditEvent = () => {
      syncOverlayEditMode();
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

  const locationPoints = useMemo(() => {
    const maxImageIndex = CONFIG[projectId].numberOfImages;

    return Object.entries(CONFIG[projectId].location)
      .map(([key, value]) => ({
        key: Number.parseInt(key, 10),
        latitude: value.latitude,
        longitude: value.longitude,
      }))
      .filter(
        (point): point is LocationPoint =>
          Number.isFinite(point.key) &&
          point.key >= 1 &&
          point.key <= maxImageIndex &&
          typeof point.latitude === "number" &&
          Number.isFinite(point.latitude) &&
          typeof point.longitude === "number" &&
          Number.isFinite(point.longitude),
      )
      .sort((a, b) => a.key - b.key);
  }, [projectId]);

  useEffect(() => {
    if (typeof window === "undefined" || !locationPoints.length) {
      return;
    }

    const key = `${projectId}:${locationPoints.length}`;
    if (prefetchedTileAreaKeysRef.current.has(key)) {
      return;
    }

    prefetchedTileAreaKeysRef.current.add(key);
    const urls = buildPrefetchTileUrls(locationPoints);
    if (!urls.length) {
      return;
    }

    let cancelled = false;
    let cursor = 0;
    const workers = Array.from({ length: TILE_PREFETCH_CONCURRENCY }, async () => {
      while (!cancelled) {
        const index = cursor;
        cursor += 1;
        if (index >= urls.length) {
          break;
        }

        try {
          await fetch(urls[index], {
            mode: "no-cors",
            cache: "reload",
          });
        } catch {
          // Keep warming remaining tiles even if some requests fail.
        }
      }
    });

    void Promise.allSettled(workers);
    return () => {
      cancelled = true;
    };
  }, [locationPoints, projectId]);

  const currentImageKey = useMemo(() => {
    const keyFromPath = parseImageKeyFromPathname(pathname);
    if (keyFromPath !== null) {
      return keyFromPath;
    }

    return locationPoints[0]?.key ?? 1;
  }, [locationPoints, pathname]);

  const nearestLocationPoint = useMemo(() => {
    if (!locationPoints.length) {
      return null;
    }

    const reachedPoints = locationPoints.filter(
      (point) => point.key <= currentImageKey,
    );

    return reachedPoints[reachedPoints.length - 1] ?? locationPoints[0];
  }, [currentImageKey, locationPoints]);

  useEffect(() => {
    if (!nearestLocationPoint) {
      return;
    }

    setPosition({
      latitude: nearestLocationPoint.latitude,
      longitude: nearestLocationPoint.longitude,
    });
  }, [nearestLocationPoint, setPosition]);

  const activeLatitude = nearestLocationPoint?.latitude ?? position.latitude ?? 0;
  const activeLongitude = nearestLocationPoint?.longitude ?? position.longitude ?? 0;

  useEffect(() => {
    setMapViewState((current) => ({
      latitude: activeLatitude,
      longitude: activeLongitude,
      zoom: current.zoom || zoom,
    }));
  }, [activeLatitude, activeLongitude, zoom]);

  const allPathCoordinates = useMemo(
    () =>
      locationPoints.map(
        (point) => [point.longitude, point.latitude] as [number, number],
      ),
    [locationPoints],
  );

  const visitedPathCoordinates = useMemo(() => {
    if (!nearestLocationPoint) {
      return [];
    }

    return locationPoints
      .filter((point) => point.key <= nearestLocationPoint.key)
      .map((point) => [point.longitude, point.latitude] as [number, number]);
  }, [locationPoints, nearestLocationPoint]);

  const allJourneyLineData = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(
    () => {
      if (allPathCoordinates.length < 2) {
        return null;
      }

      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: allPathCoordinates,
        },
        properties: {},
      };
    },
    [allPathCoordinates],
  );

  const visitedJourneyLineData = useMemo<
    GeoJSON.Feature<GeoJSON.LineString> | null
  >(() => {
    if (visitedPathCoordinates.length < 2) {
      return null;
    }

    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: visitedPathCoordinates,
      },
      properties: {},
    };
  }, [visitedPathCoordinates]);

  const handleDotClick = (key: number) => {
    if (typeof window === "undefined") {
      router.push(`/${projectId}/${key}`);
      return;
    }

    const query = new URLSearchParams(window.location.search).toString();
    router.push(`/${projectId}/${key}${query ? `?${query}` : ""}`);
  };

  const handleMapClick = (event: MapClickEvent) => {
    if (!locationPoints.length) {
      return;
    }

    const { lng, lat } = event.lngLat;
    const nearestPoint = locationPoints.reduce((nearest, candidate) => {
      const nearestDistance =
        (nearest.longitude - lng) ** 2 + (nearest.latitude - lat) ** 2;
      const candidateDistance =
        (candidate.longitude - lng) ** 2 + (candidate.latitude - lat) ** 2;

      return candidateDistance < nearestDistance ? candidate : nearest;
    }, locationPoints[0]);

    handleDotClick(nearestPoint.key);
  };

  const isTouchOrbView = isTouchDevice && isOrbLikeView;
  const canDragMapPosition = isTouchOrbView && overlayPositionEditEnabled;
  const canDragCoordinateBadge = isTouchOrbView && overlayPositionEditEnabled;

  const updateMapOverlayPosition = useCallback((right: number, vertical: number) => {
    if (typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;
    root.style.setProperty("--overlay-map-right", `${right}px`);
    root.style.setProperty("--overlay-map-vertical", `${vertical}px`);
    window.dispatchEvent(
      new CustomEvent(OVERLAY_LAYOUT_CHANGE_EVENT, {
        detail: { mapRight: right, mapVertical: vertical },
      }),
    );
  }, []);

  const handleMapDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!canDragMapPosition) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const startRight = parseCssVarPx("--overlay-map-right", 8);
      const startVertical = parseCssVarPx("--overlay-map-vertical", 8);
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startRight,
        startVertical,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [canDragMapPosition],
  );

  const handleMapDragMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    updateMapOverlayPosition(
      dragState.startRight - deltaX,
      dragState.startVertical - deltaY,
    );
  }, [updateMapOverlayPosition]);

  const handleMapDragEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const orbMapWidth = isTouchOrbView ? height : width;
  const orbMapHeight = isTouchOrbView ? width : height;
  const mapWidth = isOrbLikeView ? orbMapWidth : "clamp(24vw, 25vw, 150px)";
  const mapHeight = isOrbLikeView ? orbMapHeight : "clamp(16vw, 20vw, 120px)";
  const mapBottom = isOrbLikeView ? "var(--overlay-map-vertical, 8px)" : "8px";
  const mapRight = isOrbLikeView ? "var(--overlay-map-right, 8px)" : "8px";
  const mapTransform = isTouchOrbView ? "rotate(0deg)" : undefined;
  const mapTransformOrigin = isTouchOrbView ? "bottom right" : undefined;
  const mapWidthPx = typeof mapWidth === "number" ? mapWidth : width;
  const mapHeightPx = typeof mapHeight === "number" ? mapHeight : height;
  const mapRightPx = parseCssVarPx("--overlay-map-right", 8);
  const mapVerticalPx = parseCssVarPx("--overlay-map-vertical", 8);
  void overlayLayoutTick;
  const defaultCoordinateBadgeRightPx = isTouchDevice
    ? mapRightPx + mapWidthPx / 8
    : mapRightPx;
  const defaultCoordinateBadgeBottomPx = isTouchDevice
    ? mapVerticalPx + mapWidthPx / 8
    : mapVerticalPx + mapHeightPx + 8;
  const coordinateBadgeRight = `calc(var(${OVERLAY_MAP_LABEL_RIGHT_VAR}, ${defaultCoordinateBadgeRightPx}px) + var(${OVERLAY_MAP_LABEL_RIGHT_OFFSET_VAR}, 0px))`;
  const coordinateBadgeBottom = `calc(var(${OVERLAY_MAP_LABEL_BOTTOM_VAR}, ${defaultCoordinateBadgeBottomPx}px) + var(${OVERLAY_MAP_LABEL_BOTTOM_OFFSET_VAR}, 0px))`;

  const updateCoordinateBadgePosition = useCallback((right: number, bottom: number) => {
    if (typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;
    root.style.setProperty(OVERLAY_MAP_LABEL_RIGHT_VAR, `${right}px`);
    root.style.setProperty(OVERLAY_MAP_LABEL_BOTTOM_VAR, `${bottom}px`);
  }, []);

  const handleCoordinateBadgeDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!canDragCoordinateBadge) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const startRight = parseCssVarPx(
        OVERLAY_MAP_LABEL_RIGHT_VAR,
        defaultCoordinateBadgeRightPx,
      );
      const startBottom = parseCssVarPx(
        OVERLAY_MAP_LABEL_BOTTOM_VAR,
        defaultCoordinateBadgeBottomPx,
      );
      labelDragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startRight,
        startBottom,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [
      canDragCoordinateBadge,
      defaultCoordinateBadgeBottomPx,
      defaultCoordinateBadgeRightPx,
    ],
  );

  const handleCoordinateBadgeDragMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = labelDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      updateCoordinateBadgePosition(
        dragState.startRight - deltaX,
        dragState.startBottom - deltaY,
      );
    },
    [updateCoordinateBadgePosition],
  );

  const handleCoordinateBadgeDragEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = labelDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      labelDragStateRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );
  const mapFrameStyle: CSSProperties = {
    width: mapWidth,
    border: "2px solid white",
    borderRadius: 8,
    overflow: "hidden",
    height: mapHeight,
    position: "fixed",
    bottom: mapBottom,
    right: mapRight,
    transform: mapTransform,
    transformOrigin: mapTransformOrigin,
    zIndex: 200,
    boxShadow: "0px 0px 2px 1px rgba(0, 0, 0, 0.2)",
  };
  const activeMapStyle = useFallbackMapStyle
    ? CARTO_LIGHT_RASTER_STYLE
    : OSM_RASTER_STYLE;

  const handleMapLoadError = useCallback(() => {
    if (!useFallbackMapStyle) {
      setUseFallbackMapStyle(true);
      return;
    }

    setTileLoadWarning(true);
  }, [useFallbackMapStyle]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const resizeMap = () => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      try {
        map.resize();
      } catch {
        // Ignore map resize race conditions while switching views/routes.
      }
    };

    const timers: number[] = [];
    const scheduleResize = () => {
      resizeMap();
      timers.push(window.setTimeout(resizeMap, 120));
      timers.push(window.setTimeout(resizeMap, 320));
    };

    scheduleResize();
    window.addEventListener("resize", scheduleResize);
    window.addEventListener("orientationchange", scheduleResize);

    return () => {
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("orientationchange", scheduleResize);
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [
    activeLatitude,
    activeLongitude,
    isOrbLikeView,
    isTouchOrbView,
    mapHeight,
    mapWidth,
    pathname,
  ]);

  return (
    <div>
      <div
        className={`fixed rounded-md border-2 border-white/50 bg-gray-900/60 px-2 py-1 text-[11px] text-white shadow-sm ${
          isOrbLikeView ? "z-[210]" : "right-2 top-2 z-[198]"
        }`}
        onPointerDown={handleCoordinateBadgeDragStart}
        onPointerMove={handleCoordinateBadgeDragMove}
        onPointerUp={handleCoordinateBadgeDragEnd}
        onPointerCancel={handleCoordinateBadgeDragEnd}
        style={
          isOrbLikeView
            ? {
                // `backdrop-filter` is the intended effect here; keep WebKit + fallback.
                right: coordinateBadgeRight,
                bottom: coordinateBadgeBottom,
                touchAction: canDragCoordinateBadge ? "none" : "auto",
                transform: 'rotate(-90deg)',
              }
            : undefined
        }
      >
        {isOrbLikeView && 'PLEASE INTERACT WITH THE LOCATION:'}📍 [{formatCoordinate(activeLatitude)}°, {formatCoordinate(activeLongitude)}°]
      </div>
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        latitude={mapViewState.latitude}
        longitude={mapViewState.longitude}
        zoom={mapViewState.zoom}
        dragPan={!canDragMapPosition}
        scrollZoom={true}
        doubleClickZoom={false}
        touchZoomRotate={!canDragMapPosition}
        dragRotate={false}
        keyboard={false}
        attributionControl={false}
        onClick={handleMapClick}
        onMove={(event) =>
          setMapViewState((current) => ({
            ...current,
            latitude: event.viewState.latitude,
            longitude: event.viewState.longitude,
            zoom: event.viewState.zoom,
          }))
        }
        onLoad={() => {
          setTileLoadWarning(false);
        }}
        onError={() => {
          handleMapLoadError();
        }}
        style={mapFrameStyle}
        mapStyle={activeMapStyle}
      >
        {allJourneyLineData && (
          <Source id={`journey-all-${projectId}`} type="geojson" data={allJourneyLineData}>
            <Layer
              id={`journey-all-layer-${projectId}`}
              type="line"
              paint={{
                "line-color": "#ffffff",
                "line-opacity": 0.38,
                "line-width": 2,
                "line-dasharray": [2, 1],
              }}
            />
          </Source>
        )}
        {visitedJourneyLineData && (
          <Source
            id={`journey-visited-${projectId}`}
            type="geojson"
            data={visitedJourneyLineData}
          >
            <Layer
              id={`journey-visited-layer-${projectId}`}
              type="line"
              paint={{
                "line-color": "#22d3ee",
                "line-opacity": 0.9,
                "line-width": 3,
              }}
            />
          </Source>
        )}
        {locationPoints.map((point) => {
          const isCurrent = point.key === nearestLocationPoint?.key;
          const isVisited =
            nearestLocationPoint !== null && point.key <= nearestLocationPoint.key;

          return (
            <Marker
              key={`${projectId}-${point.key}`}
              latitude={point.latitude}
              longitude={point.longitude}
              anchor="center"
              style={{
                zIndex: hoveredKey === point.key ? 3000 : isCurrent ? 2000 : 1000,
              }}
            >
              <div className="relative">
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDotClick(point.key);
                  }}
                  onMouseEnter={() => setHoveredKey(point.key)}
                  onMouseLeave={() =>
                    setHoveredKey((current) =>
                      current === point.key ? null : current,
                    )
                  }
                  onFocus={() => setHoveredKey(point.key)}
                  onBlur={() =>
                    setHoveredKey((current) =>
                      current === point.key ? null : current,
                    )
                  }
                  aria-label={`Jump to image ${point.key}`}
                  className={`h-5 w-5 cursor-pointer rounded-full border border-white/50 shadow-md transition pointer-events-auto ${
                    isCurrent
                      ? "bg-cyan-300 ring-2 ring-cyan-100/80"
                      : isVisited
                        ? "bg-cyan-600 hover:bg-cyan-500"
                        : "bg-slate-500 hover:bg-slate-400"
                  } ${hoveredKey === point.key ? "scale-110" : "scale-100"}`}
                  title={`${formatCoordinate(point.latitude)}, ${formatCoordinate(point.longitude)}`}
                />
                {hoveredKey === point.key && (
                  <div
                    className="pointer-events-none absolute left-1/2 top-[-34px] z-[250] -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-1.5 py-1 text-[10px] text-white shadow-lg"
                    style={{
                      fontFamily:
                        "var(--font-plus-jakarta-sans), ui-sans-serif, system-ui, sans-serif",
                    }}
                  >
                    {formatCoordinate(point.latitude)}, {formatCoordinate(point.longitude)}
                  </div>
                )}
              </div>
            </Marker>
          );
        })}
      </Map>
      {tileLoadWarning && (
        <div
          className={`fixed rounded-md border border-amber-300/80 bg-black/75 px-2 py-1 text-[11px] text-amber-100 ${
            isOrbLikeView ? "z-[210]" : "right-2 top-12 z-[198]"
          }`}
          style={
            isOrbLikeView
              ? {
                  right: mapRight,
                  bottom: `calc(${mapBottom} + ${mapHeightPx}px + 8px)`,
                }
              : undefined
          }
        >
          Basemap unavailable. Route points still active.
        </div>
      )}
      {canDragMapPosition && (
        <div
          className="fixed z-[205] rounded-md border border-cyan-300/70 bg-cyan-300/10"
          style={{
            width: mapWidth,
            height: mapHeight,
            bottom: mapBottom,
            right: mapRight,
            transform: mapTransform,
            transformOrigin: mapTransformOrigin,
            touchAction: "none",
          }}
          onPointerDown={handleMapDragStart}
          onPointerMove={handleMapDragMove}
          onPointerUp={handleMapDragEnd}
          onPointerCancel={handleMapDragEnd}
          aria-label="Drag map position"
        />
      )}
    </div>
  );
};

export default LocationMap;
