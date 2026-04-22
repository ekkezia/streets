"use client";

import { CONFIG, ProjectId } from "@/config/config";
import { useLocationContext } from "@/contexts/location-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import Map, { Layer, Marker, Source } from "react-map-gl/maplibre";

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
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"] as string[],
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

const parseImageKeyFromPathname = (pathname: string): number | null => {
  const segment = pathname.split("/").filter(Boolean)[1];
  const parsed = Number.parseInt(segment ?? "", 10);

  return Number.isFinite(parsed) ? parsed : null;
};

const formatCoordinate = (value: number) => value.toFixed(6);

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
  const [mapViewState, setMapViewState] = useState<MapViewState>({
    latitude: 0,
    longitude: 0,
    zoom,
  });

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
    const query =
      typeof window !== "undefined" ? window.location.search ?? "" : "";
    router.push(`/${projectId}/${key}${query}`);
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

  return (
    <div>
      <div className="fixed right-2 top-2 z-[998] rounded-md border-2 border-white bg-gray-900/60 px-2 py-1 text-[11px] text-white shadow-sm">
        📍 [{formatCoordinate(activeLatitude)}°, {formatCoordinate(activeLongitude)}°]
      </div>
      <div className="fixed bottom-[176px] right-2 z-[1100] rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
        Hover a dot for lat/lon
      </div>
      <Map
        mapLib={maplibregl}
        latitude={mapViewState.latitude}
        longitude={mapViewState.longitude}
        zoom={mapViewState.zoom}
        dragPan={true}
        scrollZoom={true}
        doubleClickZoom={false}
        touchZoomRotate={true}
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
        style={{
          width: width,
          border: "2px solid white",
          borderRadius: 8,
          height: height,
          position: "fixed",
          bottom: "8px",
          right: "8px",
          zIndex: 1100,
          boxShadow: "0px 0px 2px 1px rgba(0, 0, 0, 0.2)",
        }}
        mapStyle={OSM_RASTER_STYLE}
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
                  className={`h-5 w-5 cursor-pointer rounded-full border border-white/90 shadow-md transition pointer-events-auto ${
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
                    className="pointer-events-none absolute left-1/2 top-[-34px] z-[9999] -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-1.5 py-1 text-[10px] text-white shadow-lg"
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
    </div>
  );
};

export default LocationMap;
