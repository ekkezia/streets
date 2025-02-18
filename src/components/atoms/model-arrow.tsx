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
      <mesh position={[-0.25, 0, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[1, 0, 0.3]} />
        <meshStandardMaterial color={hovered ? "pink" : "white"} />
      </mesh>

      {/* Arrow down */}
      <mesh position={[0.25, 0, 0]} rotation={[0, -Math.PI / 4, 0]}>
        <boxGeometry args={[1, 0, 0.3]} />
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
export type ArrowDirection = "reverse" | "forward" | "left" | "right" | "up" | "down";
type Position = {
  [key: string]: {
    position: any;
    rotation: any;
  };
};
const POSITION: Position = {
    // TODO: change to forward n reverse
  reverse: {
    position: [0, -1.5, -1],
    rotation: [0, 0, 0],
  },
  forward: {
    position: [0, -1.5, 1.8],
    rotation: [Math.PI, 0, 0],
  },
  left: {
    position: [-1.5, -1.5, 0.5],
    rotation: [0, Math.PI / 2, 0],
  },
  right: {
    position: [1.5, -1.5, 0.5],
    rotation: [0, -Math.PI / 2, 0],
  },
  // TODO: change to up n down
  up: {
    position: [0, -2, -1],
    rotation: [Math.PI/2, 0, 0],
  },
  down: {
    position: [0, -2.5, 1],
    rotation: [-Math.PI/2, 0, 0],
  },

};

export const Move: React.FC<{
  projectId: ProjectId;
  direction: ArrowDirection;
  tooltip: string | null;
  value: number;
  currentModel: number;
  onMove: (id: number) => void;
}> = ({ projectId, direction = "reverse", value, tooltip = null, currentModel, onMove }) => {
  // const { currentModel, setCurrentModel } = useModelContext();
  const handleMove = () => {
    onMove(currentModel + value);
    history.pushState(
      {},
      "",
      `/${projectId}/${(currentModel + value).toString()}`,
    );
  };

  const getTooltip = () => {
    if (tooltip === null) {
    // default tooltip
    switch (direction) {
      case "reverse":
        return "Reverse";
      case "forward":
        return "Forward";
      case "left":
        return "Left";
      case "right":
        return "Right";
      case "up":
        return "reverse";
      case "down":
        return "forward";
    }

    } else return tooltip
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
