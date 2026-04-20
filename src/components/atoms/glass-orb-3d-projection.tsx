"use client";

import React from "react";
import GlassOrbProjection, {
  GlassOrbSettings,
  OrbRotationSnapshot,
} from "./glass-orb-projection";
import type { TrackedSubject } from "./subject-presence";
import { MathUtils, Texture } from "three";

const GlassOrb3DProjection: React.FC<{
  texture: Texture;
  settings: GlassOrbSettings;
  trackedSubjects?: TrackedSubject[];
  headFollowPositionEnabled?: boolean;
  headFollowPositionStrength?: number;
  listenerMode?: boolean;
  remoteRotation?: OrbRotationSnapshot | null;
  onRotationChange?: (rotation: OrbRotationSnapshot) => void;
}> = ({
  texture,
  settings,
  trackedSubjects = [],
  headFollowPositionEnabled = false,
  headFollowPositionStrength = 1,
  listenerMode = false,
  remoteRotation = null,
  onRotationChange,
}) => {
  const hologramRadius = settings.radius * 0.58;
  const spacing = hologramRadius * 3.25;
  const yLift = hologramRadius * 0.32;

  const hologramViews: Array<{
    id: string;
    position: [number, number, number];
    yawOffset: number;
  }> = [
    {
      id: "top",
      position: [0, spacing + yLift, 0],
      yawOffset: Math.PI,
    },
    {
      id: "right",
      position: [spacing, yLift, 0],
      yawOffset: -Math.PI / 2,
    },
    {
      id: "bottom",
      position: [0, -spacing + yLift, 0],
      yawOffset: 0,
    },
    {
      id: "left",
      position: [-spacing, yLift, 0],
      yawOffset: Math.PI / 2,
    },
  ];

  return (
    <group>
      {hologramViews.map((view) => (
        <group key={view.id} position={view.position}>
          <GlassOrbProjection
            texture={texture}
            settings={{
              ...settings,
              radius: hologramRadius,
              yaw: MathUtils.euclideanModulo(
                settings.yaw + view.yawOffset + Math.PI,
                Math.PI * 2,
              ) - Math.PI,
            }}
            trackedSubjects={trackedSubjects}
            headFollowPositionEnabled={headFollowPositionEnabled}
            headFollowPositionStrength={headFollowPositionStrength}
            listenerMode={listenerMode}
            remoteRotation={
              listenerMode && remoteRotation
                ? {
                    yaw:
                      MathUtils.euclideanModulo(
                        remoteRotation.yaw + view.yawOffset + Math.PI,
                        Math.PI * 2,
                      ) - Math.PI,
                    xRotation: remoteRotation.xRotation,
                  }
                : null
            }
            onRotationChange={
              !listenerMode && view.id === "bottom" ? onRotationChange : undefined
            }
          />
        </group>
      ))}
    </group>
  );
};

export default GlassOrb3DProjection;
