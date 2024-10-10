'use client';
import React, { createContext, useState, ReactNode, useContext } from 'react';

interface ModelContextType {
  currentModel: number;
  setCurrentModel: (id: number) => void;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export const ModelContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [currentModel, setCurrentModel] = useState<number>(1);

  return (
    <ModelContext.Provider value={{ currentModel, setCurrentModel }}>
      {children}
    </ModelContext.Provider>
  );
};

export const useModelContext = (): ModelContextType => {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error('useCube must be used within a ModelContextProvider');
  }
  return context;
};
