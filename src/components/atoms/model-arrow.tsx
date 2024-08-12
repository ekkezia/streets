'use client'

import { PATHS } from '@/config/paths';
import { useModelContext } from '@/contexts/model-context';
import React, { useState } from "react";

export const ArrowForward:React.FC = () => {
    const { currentModel, setCurrentModel } = useModelContext()
    const [hovered, setHovered] = useState(false);

  const handleForward = () => {
    if (currentModel !== PATHS.length - 1 || currentModel === 0) {
      setCurrentModel(currentModel + 1);
    }
  }

  if (currentModel !== PATHS.length - 1 || currentModel === 0) {
    return (<mesh position={[0, 1, 0]} onClick={handleForward}       onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color={hovered ? "pink" : "white"} />
      </mesh>)

  }

  return <></>
  }

  export const ArrowBackward:React.FC = () => {
    const { currentModel, setCurrentModel } = useModelContext()
    const [hovered, setHovered] = useState(false);

  const handleBackward = () => {
    if (currentModel !== 0 || currentModel === PATHS.length - 1) {
      setCurrentModel(currentModel - 1);
    }
  }

  if (currentModel !== 0 || currentModel === PATHS.length - 1) {
    return (<mesh position={[0, -1, 0]} onClick={handleBackward}       onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color={hovered ? "pink" : "white"} />
      </mesh>)
  }

  return <></>
  }

