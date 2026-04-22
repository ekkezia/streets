"use client";

import { useFrame } from "@react-three/fiber";
import React, { useRef } from "react";
import { DoubleSide, Group, MathUtils, Quaternion, Texture, Vector3 } from "three";
import type { TrackedSubject } from "./subject-presence";

export type GlassOrbSettings = {
  radius: number;
  yaw: number;
  xRotation: number;
};

export type OrbRotationSnapshot = {
  yaw: number;
  xRotation: number;
};

export const DEFAULT_GLASS_ORB_SETTINGS: GlassOrbSettings = {
  radius: 1.35,
  yaw: 1.7,
  xRotation: 0.1,
};

const POINTER_YAW_RANGE = Math.PI;
const POINTER_TILT_RANGE = Math.PI;
const ROTATION_SMOOTHING = 10;
const POSITION_SMOOTHING = 8;
const HEAD_MOVE_RANGE_X = 1.8;
const HEAD_MOVE_RANGE_Y = 1.4;
const HEAD_ROTATE_YAW_RANGE = Math.PI * 1.1;
const HEAD_ROTATE_TILT_RANGE = Math.PI * 0.75;
const MARKER_INPUT_GAIN_X = 2.35;
const MARKER_INPUT_GAIN_Y = 2.1;
const MARKER_FORWARD = new Vector3(0, 0, 1);

const GlassOrbProjection: React.FC<{
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
  const orbGroupRef = useRef<Group>(null);
  const currentYawRef = useRef(settings.yaw);
  const currentXRotationRef = useRef(settings.xRotation);
  const currentPositionXRef = useRef(0);
  const currentPositionYRef = useRef(0);

  const activeSubject = trackedSubjects.reduce<TrackedSubject | null>(
    (best, subject) => {
      if (!best) {
        return subject;
      }

      if (subject.confidence === best.confidence) {
        return subject.lastUpdated > best.lastUpdated ? subject : best;
      }

      return subject.confidence > best.confidence ? subject : best;
    },
    null,
  );

  useFrame((state, delta) => {
    if (!orbGroupRef.current) {
      return;
    }

    let targetPositionX = 0;
    let targetPositionY = 0;
    let targetYaw = settings.yaw;
    let targetXRotation = settings.xRotation;

    if (listenerMode && remoteRotation) {
      targetYaw = remoteRotation.yaw;
      targetXRotation = remoteRotation.xRotation;
    } else {
      let headYawOffset = 0;
      let headTiltOffset = 0;

      if (headFollowPositionEnabled && activeSubject) {
        const normalizedX = MathUtils.clamp(activeSubject.x, 0, 1) - 0.5;
        const normalizedY = 0.5 - MathUtils.clamp(activeSubject.y, 0, 1);
        const headStrength = MathUtils.clamp(headFollowPositionStrength, 0, 2.5);

        targetPositionX =
          normalizedX * settings.radius * HEAD_MOVE_RANGE_X * headStrength;
        targetPositionY =
          normalizedY * settings.radius * HEAD_MOVE_RANGE_Y * headStrength;

        headYawOffset = normalizedX * HEAD_ROTATE_YAW_RANGE * headStrength;
        headTiltOffset = normalizedY * HEAD_ROTATE_TILT_RANGE * headStrength;
      }

      targetYaw = settings.yaw + state.pointer.x * POINTER_YAW_RANGE + headYawOffset;
      targetXRotation =
        settings.xRotation - state.pointer.y * POINTER_TILT_RANGE + headTiltOffset;
    }

    const alpha = 1 - Math.exp(-ROTATION_SMOOTHING * delta);
    const positionAlpha = 1 - Math.exp(-POSITION_SMOOTHING * delta);
    currentYawRef.current = MathUtils.lerp(currentYawRef.current, targetYaw, alpha);
    currentXRotationRef.current = MathUtils.lerp(
      currentXRotationRef.current,
      targetXRotation,
      alpha,
    );

    currentPositionXRef.current = MathUtils.lerp(
      currentPositionXRef.current,
      targetPositionX,
      positionAlpha,
    );
    currentPositionYRef.current = MathUtils.lerp(
      currentPositionYRef.current,
      targetPositionY,
      positionAlpha,
    );

    orbGroupRef.current.rotation.set(
      currentXRotationRef.current,
      currentYawRef.current,
      0,
    );
    orbGroupRef.current.position.set(
      currentPositionXRef.current,
      currentPositionYRef.current,
      0,
    );

    if (onRotationChange) {
      onRotationChange({
        yaw: currentYawRef.current,
        xRotation: currentXRotationRef.current,
      });
    }
  });

  return (
    <group ref={orbGroupRef}>
      <mesh>
        <sphereGeometry args={[settings.radius, 64, 64]} />
        <meshBasicMaterial map={texture} />
      </mesh>

      {trackedSubjects.slice(0, 24).map((subject) => {
        const responsiveX = MathUtils.clamp(
          0.5 + (MathUtils.clamp(subject.x, 0, 1) - 0.5) * MARKER_INPUT_GAIN_X,
          0,
          1,
        );
        const responsiveY = MathUtils.clamp(
          0.5 + (MathUtils.clamp(subject.y, 0, 1) - 0.5) * MARKER_INPUT_GAIN_Y,
          0,
          1,
        );
        const longitude = (responsiveX - 0.5) * Math.PI * 2;
        const latitude = (0.5 - responsiveY) * Math.PI;
        const depthOffset = MathUtils.clamp(-subject.z * 0.08, -0.08, 0.12);
        const markerRadius = settings.radius + 0.07 + depthOffset;

        const cosLatitude = Math.cos(latitude);
        const position = new Vector3(
          markerRadius * cosLatitude * Math.sin(longitude),
          markerRadius * Math.sin(latitude),
          markerRadius * cosLatitude * Math.cos(longitude),
        );

        const normal = position.clone().normalize();
        const orientation = new Quaternion().setFromUnitVectors(
          MARKER_FORWARD,
          normal,
        );
        const markerScale = MathUtils.lerp(
          0.85,
          1.2,
          MathUtils.clamp(subject.confidence, 0, 1),
        );

        return (
          <group
            key={subject.sourceId}
            position={position}
            quaternion={orientation}
            scale={markerScale}
          >
            <mesh>
              <ringGeometry args={[0.03, 0.055, 32]} />
              <meshBasicMaterial
                color="#00f7ff"
                opacity={0.95}
                side={DoubleSide}
                transparent
              />
            </mesh>
            <mesh position={[0, 0, 0.002]}>
              <circleGeometry args={[0.02, 32]} />
              <meshBasicMaterial
                color="#00f7ff"
                opacity={0.38}
                side={DoubleSide}
                transparent
              />
            </mesh>
          </group>
        );
      })}

      <mesh>
        <sphereGeometry args={[settings.radius + 0.03, 64, 64]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.25}
          roughness={0.05}
          metalness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.02}
          transmission={0.6}
          ior={1.45}
          thickness={0.35}
        />
      </mesh>
    </group>
  );
};

export default GlassOrbProjection;
