"use client"

import { CONFIG, ProjectId } from '@/config/config';
import { useLocationContext } from '@/contexts/location-context';
import dynamic from "next/dynamic";
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const Map = dynamic(() => import('react-map-gl/maplibre'), { ssr: false });
// const Marker = dynamic(() => import('react-map-gl/maplibre'), { ssr: false });

const LocationMap: React.FC<{
  zoom?: number;
  width?: number;
  height?: number;
  projectId: ProjectId
}> = ({ zoom = 16, width = 120, height = 80, projectId }) => {
  const { position, setPosition } = useLocationContext();

  const pathname = usePathname();

  useEffect(() => {
    if (pathname.split('/')[2]) {
      if(CONFIG[projectId].location[pathname.split('/')[2]]) {
        setPosition(CONFIG[projectId].location[pathname.split('/')[2]])
      }
    } else {
      setPosition(CONFIG[projectId].location["1"])
    }
  }, [pathname])

  return (
    <div>
    <div className="fixed text-xs right-2 top-2 text-white z-[998] bg-gray-900/60 px-1 shadow-sm border-2 border-white rounded-md"
    >
      📍 [{position.latitude}°, {position.longitude}°]
      </div>
    <Map
      initialViewState={{
        latitude: position.latitude,
        longitude: position.longitude,
        zoom: zoom
      }}
      style={{ width: width, border: '2px solid white', borderRadius: 8, height: height, position: 'fixed', bottom: '8px', right: '8px', zIndex: 998, boxShadow: '0px 0px 2px 1px rgba(0, 0, 0, 0.2)' }}
      mapStyle="https://api.maptiler.com/maps/streets/style.json?key=5fFDQ4E7qSxl7QlDzJ8h"
    >
    </Map>
    </div>
  );
}

export default LocationMap;
