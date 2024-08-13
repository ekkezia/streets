'use client'

import { PATHS } from '@/config/paths';
import { useModelContext } from '@/contexts/model-context';
import React, { useState } from "react";

const Arrow: React.FC<{ onClick: () => void } & JSX.IntrinsicElements['mesh']> = ({ onClick, ...meshProps }) => {
  const [hovered, setHovered] = useState(false);

  return (
      <mesh
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        {...meshProps}
      >
        {/* Arrow up */}
        <mesh position={[-0.3, 0, 0]} rotation={[0, Math.PI/4, 0]}>
          <boxGeometry args={[1, 0.2, 0.2]} />
          <meshStandardMaterial color={hovered ? 'pink' : 'white'} />
        </mesh>

        {/* Arrow down */}
        <mesh position={[0.3, 0, 0]} rotation={[0, -Math.PI/4, 0]}>
          <boxGeometry args={[1, 0.2, 0.2]} />
          <meshStandardMaterial color={hovered ? 'pink' : 'white'} />
        </mesh>
      </mesh>
    )
}

export const ArrowForward:React.FC = () => {
    const { currentModel, setCurrentModel } = useModelContext()

    const handleForward = () => {
        setCurrentModel(currentModel + 1);
    }

    if (currentModel !== PATHS.length - 1 || currentModel === 0) {
      return (
        <Arrow onClick={handleForward} position={[0, -2, -1]}
 />
      )
    }

    return <></>
}

export const ArrowBackward:React.FC = () => {
    const { currentModel, setCurrentModel } = useModelContext()

    const handleBackward = () => {
        setCurrentModel(currentModel - 1);
    }

    if (currentModel !== 0 || currentModel === PATHS.length - 1) {
      return (
        <Arrow onClick={handleBackward} position={[0, -2, 1]} rotation={[Math.PI, 0, 0]} />
      )
    }

    return <></>
}