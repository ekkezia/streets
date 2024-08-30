"use client";

import { ProjectId } from "@/config/config";
import { CONFIG } from "@/config/config";
import { useModelContext } from "@/contexts/model-context";
import React, { useState } from "react";

// current model starts from 1
const Arrow: React.FC<
  { onClick: () => void } & JSX.IntrinsicElements["mesh"]
> = ({ onClick, ...meshProps }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <mesh
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      {...meshProps}
    >
      {/* Arrow up */}
      <mesh position={[-0.3, 0, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[1, 0.2, 0.2]} />
        <meshStandardMaterial color={hovered ? "pink" : "white"} />
      </mesh>

      {/* Arrow down */}
      <mesh position={[0.3, 0, 0]} rotation={[0, -Math.PI / 4, 0]}>
        <boxGeometry args={[1, 0.2, 0.2]} />
        <meshStandardMaterial color={hovered ? "pink" : "white"} />
      </mesh>
    </mesh>
  );
};

// up: -1
// down: +1
// left: +1
// right: +1
export type ArrowDirection = "up" | "down" | "left" | "right";
type Position = {
  [key: string]: {
    position: any;
    rotation: any;
  };
};
const POSITION: Position = {
  up: {
    position: [0, -2, -1],
    rotation: [0, 0, 0],
  },
  down: {
    position: [0, -2, 1.8],
    rotation: [Math.PI, 0, 0],
  },
  left: {
    position: [-1, -2, 0.5],
    rotation: [0, Math.PI / 2, 0],
  },
  right: {
    position: [1, -2, 0.5],
    rotation: [0, -Math.PI / 2, 0],
  },
};

export const Move: React.FC<{
  projectId: ProjectId;
  direction: ArrowDirection;
  value: number;
}> = ({ projectId, direction = "up", value }) => {
  const { currentModel, setCurrentModel } = useModelContext();
  const handleMove = () => {
    setCurrentModel(currentModel + value);
    history.pushState({}, "", (currentModel + value).toString());
  };

  if (currentModel !== 0 || currentModel === CONFIG[projectId].numberOfImages - 1) {
    return (
      <Arrow
        onClick={handleMove}
        position={POSITION[direction].position}
        rotation={POSITION[direction].rotation}
      />
    );
  }

  return <></>;
};
