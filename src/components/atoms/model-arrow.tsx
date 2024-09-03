"use client";

import { ProjectId } from "@/config/config";
import { CONFIG } from "@/config/config";
import { useModelContext } from "@/contexts/model-context";
import { Html } from "@react-three/drei";
import React, { useState } from "react";

// current model starts from 1
const Arrow: React.FC<
  {
    onClick: () => void;
    tooltip: string;
  } & JSX.IntrinsicElements["mesh"]
> = ({ onClick, tooltip, ...meshProps }) => {
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

      {/* Tooltip */}
      {hovered && (
        <Html position={[0, 0, 0]} style={{ pointerEvents: "auto" }}>
          <div
            style={{
              backgroundColor: "black",
              color: "white",
              padding: "5px",
              borderRadius: "4px",
              fontSize: "12px",
              textAlign: "center",
            }}
          >
            {tooltip}
          </div>
        </Html>
      )}
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

  const getTooltip = () => {
    switch (direction) {
      case "up":
        return "Reverse";
      case "down":
        return "Forward";
      case "left":
        return "Left";
      case "right":
        return "Right";
    }
  };

  if (
    currentModel !== 0 ||
    currentModel === CONFIG[projectId].numberOfImages - 1
  ) {
    return (
      <Arrow
        onClick={handleMove}
        position={POSITION[direction].position}
        rotation={POSITION[direction].rotation}
        tooltip={getTooltip()}
      />
    );
  }

  return <></>;
};
