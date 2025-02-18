'use client';

import React, { createContext, useState, ReactNode, useContext } from 'react';

interface LocationContextType {
  position: { latitude: number | undefined; longitude: number | undefined };
  setPosition: (position: { latitude: number | undefined; longitude: number | undefined }) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [position, setPosition] = useState<{ latitude: number | undefined; longitude: number | undefined }>({
    latitude: 0,
    longitude: 0,
  });

  return (
    <LocationContext.Provider value={{ position, setPosition }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationContext = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationContext must be used within a LocationContextProvider');
  }
  return context;
};
