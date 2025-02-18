'use client';
import React, { createContext, useState, ReactNode, useContext } from 'react';

interface LanguageContextType {
  currentLanguage: string | undefined;
  setCurrentLanguage: (id: string | undefined) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [currentLanguage, setCurrentLanguage] = useState<string | undefined>(undefined);

  return (
    <LanguageContext.Provider value={{ currentLanguage, setCurrentLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguageContext = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useCube must be used within a LanguageContextProvider');
  }
  return context;
};
