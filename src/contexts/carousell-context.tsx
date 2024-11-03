"use client";
import React, {
  createContext,
  useState,
  ReactNode,
  useContext,
  SetStateAction,
  Dispatch,
} from "react";

interface CarousellContextType {
  display: boolean;
  setDisplay: Dispatch<SetStateAction<boolean>>;
}

const CarousellContext = createContext<CarousellContextType | undefined>(
  undefined,
);

export const CarousellContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [display, setDisplay] = useState<boolean>(false);

  return (
    <CarousellContext.Provider value={{ display, setDisplay }}>
      {children}
    </CarousellContext.Provider>
  );
};

export const useCarousellContext = (): CarousellContextType => {
  const context = useContext(CarousellContext);
  if (!context) {
    throw new Error("useCube must be used within a CarousellContextProvider");
  }
  return context;
};
