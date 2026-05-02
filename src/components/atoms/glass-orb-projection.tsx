"use client";

import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef } from "react";
import {
  DoubleSide,
  Euler,
  Group,
  MathUtils,
  Quaternion,
  Texture,
  Vector3,
} from "three";
import type { TrackedSubject } from "./subject-presence";

export type GlassOrbSettings = {
  radius: number;
  yaw: number;
  xRotation: number;
  zRotation: number;
  xOffset: number;
  yOffset: number;
};

export type OrbRotationSnapshot = {
  yaw: number;
  xRotation: number;
  zRotation: number;
};

export type HeadAxisMapping = "xRotation" | "yaw" | "zRotation";
export type HeadXAxisMapping = HeadAxisMapping;
export type HeadYAxisMapping = HeadAxisMapping;

export const DEFAULT_GLASS_ORB_SETTINGS: GlassOrbSettings = {
  radius: 2.58,
  yaw: 0,
  xRotation: 0,
  zRotation: 0,
  xOffset: 2.5,
  yOffset: -0.1,
};

const POINTER_YAW_RANGE = Math.PI;
const POINTER_TILT_RANGE = Math.PI;
const ROTATION_SMOOTHING = 10;
const POSITION_SMOOTHING = 8;
const HEAD_ROTATE_PITCH_RANGE = Math.PI * 0.98;
const HEAD_ROTATE_YAW_RANGE = Math.PI * 0.98;
const HEAD_ROTATE_TILT_RANGE = Math.PI * 0.75;
const HEAD_INPUT_DEADZONE = 0.025;
const HEAD_CROSSTALK_DAMPING = 0.28;
const MARKER_INPUT_GAIN_X = 2.35;
const MARKER_INPUT_GAIN_Y = 2.1;
const MARKER_FORWARD = new Vector3(0, 0, 1);
const EULER_ORDER: "YXZ" = "YXZ";

const GlassOrbProjection: React.FC<{
  texture: Texture;
  settings: GlassOrbSettings;
  trackedSubjects?: TrackedSubject[];
  headFollowPositionEnabled?: boolean;
  headFollowPositionStrength?: number;
  headXAxisMapping?: HeadXAxisMapping;
  headYAxisMapping?: HeadYAxisMapping;
  isolateHeadXDebug?: boolean;
  isolateHeadYDebug?: boolean;
  showRotationAxes?: boolean;
  pointerControlEnabled?: boolean;
  listenerMode?: boolean;
  allowPointerControlInListenerMode?: boolean;
  remoteRotation?: OrbRotationSnapshot | null;
  onRotationChange?: (rotation: OrbRotationSnapshot) => void;
}> = ({
  texture,
  settings,
  trackedSubjects = [],
  headFollowPositionEnabled = false,
  headFollowPositionStrength = 1,
  headXAxisMapping = "xRotation",
  headYAxisMapping = "yaw",
  isolateHeadXDebug = false,
  isolateHeadYDebug = false,
  showRotationAxes = false,
  pointerControlEnabled = true,
  listenerMode = false,
  allowPointerControlInListenerMode = false,
  remoteRotation = null,
  onRotationChange,
}) => {
  const orbGroupRef = useRef<Group>(null);
  const currentOrientationRef = useRef(new Quaternion());
  const hasInitializedOrientationRef = useRef(false);
  const currentPositionXRef = useRef(0);
  const currentPositionYRef = useRef(0);
  const baseEulerRef = useRef(new Euler(0, 0, 0, EULER_ORDER));
  const offsetEulerRef = useRef(new Euler(0, 0, 0, EULER_ORDER));
  const baseQuaternionRef = useRef(new Quaternion());
  const offsetQuaternionRef = useRef(new Quaternion());
  const targetQuaternionRef = useRef(new Quaternion());

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

    let targetPositionX = settings.xOffset;
    let targetPositionY = settings.yOffset;
    let yawOffset = 0;
    let xRotationOffset = 0;
    let zRotationOffset = 0;
    const pointerYawOffset = pointerControlEnabled
      ? state.pointer.x * POINTER_YAW_RANGE
      : 0;
    const pointerTiltOffset = pointerControlEnabled
      ? -state.pointer.y * POINTER_TILT_RANGE
      : 0;

    if (listenerMode) {
      if (remoteRotation) {
        yawOffset = remoteRotation.yaw;
        xRotationOffset = remoteRotation.xRotation;
        zRotationOffset = remoteRotation.zRotation;
      }

      if (allowPointerControlInListenerMode && pointerControlEnabled) {
        yawOffset += pointerYawOffset;
        xRotationOffset += pointerTiltOffset;
      }
    } else {
      let headYawOffset = 0;
      let headPitchOffset = 0;
      let headRollOffset = 0;

      if (headFollowPositionEnabled && activeSubject) {
        const normalizedX = MathUtils.clamp(activeSubject.x, 0, 1) - 0.5;
        const normalizedY = 0.5 - MathUtils.clamp(activeSubject.y, 0, 1);
        const headStrength = MathUtils.clamp(headFollowPositionStrength, 0, 2.5);
        const absX = Math.abs(normalizedX);
        const absY = Math.abs(normalizedY);
        const xDominant = absX >= absY;
        const yDominant = absY > absX;
        const isolatedXInput =
          absX < HEAD_INPUT_DEADZONE
            ? 0
            : normalizedX * (xDominant ? 1 : HEAD_CROSSTALK_DAMPING);
        const isolatedYInput =
          absY < HEAD_INPUT_DEADZONE
            ? 0
            : normalizedY * (yDominant ? 1 : HEAD_CROSSTALK_DAMPING);

        const applyToAxis = (axis: HeadAxisMapping, amount: number) => {
          if (axis === "yaw") {
            headYawOffset += amount;
            return;
          }
          if (axis === "zRotation") {
            headRollOffset += amount;
            return;
          }
          headPitchOffset += amount;
        };
        const getAxisRange = (axis: HeadAxisMapping) => {
          if (axis === "yaw") {
            return HEAD_ROTATE_YAW_RANGE;
          }
          if (axis === "xRotation") {
            return HEAD_ROTATE_PITCH_RANGE;
          }
          return HEAD_ROTATE_TILT_RANGE;
        };

        const shouldIsolateXOnly = isolateHeadXDebug && !isolateHeadYDebug;
        const shouldIsolateYOnly = isolateHeadYDebug && !isolateHeadXDebug;
        const headXAxisAmount = shouldIsolateYOnly
          ? 0
          : isolatedXInput * getAxisRange(headXAxisMapping) * headStrength;
        const headYAxisAmount = shouldIsolateXOnly
          ? 0
          : isolatedYInput * getAxisRange(headYAxisMapping) * headStrength;
        applyToAxis(headXAxisMapping, headXAxisAmount);
        applyToAxis(headYAxisMapping, headYAxisAmount);
      }

      yawOffset = pointerYawOffset + headYawOffset;
      xRotationOffset = pointerTiltOffset + headPitchOffset;
      zRotationOffset = headRollOffset;
    }

    const alpha = 1 - Math.exp(-ROTATION_SMOOTHING * delta);
    const positionAlpha = 1 - Math.exp(-POSITION_SMOOTHING * delta);

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

    // Compose base and live offsets as separate quaternions.
    // Adding Euler angles directly can couple channels and make one axis
    // feel like it is "taking over" when another base axis is non-zero.
    baseEulerRef.current.set(
      settings.xRotation,
      settings.yaw,
      settings.zRotation,
      EULER_ORDER,
    );
    offsetEulerRef.current.set(
      xRotationOffset,
      yawOffset,
      zRotationOffset,
      EULER_ORDER,
    );
    baseQuaternionRef.current.setFromEuler(baseEulerRef.current);
    offsetQuaternionRef.current.setFromEuler(offsetEulerRef.current);
    targetQuaternionRef.current
      .copy(baseQuaternionRef.current)
      .premultiply(offsetQuaternionRef.current);

    if (!hasInitializedOrientationRef.current) {
      currentOrientationRef.current.copy(targetQuaternionRef.current);
      hasInitializedOrientationRef.current = true;
    } else {
      currentOrientationRef.current.slerp(targetQuaternionRef.current, alpha);
    }

    orbGroupRef.current.quaternion.copy(currentOrientationRef.current);
    orbGroupRef.current.rotation.reorder(EULER_ORDER);
    orbGroupRef.current.rotation.setFromQuaternion(
      currentOrientationRef.current,
      EULER_ORDER,
    );
    orbGroupRef.current.position.set(
      currentPositionXRef.current,
      currentPositionYRef.current,
      0,
    );

    if (onRotationChange) {
      // Send axis-pure offsets directly. Converting quaternion -> Euler can
      // re-mix channels and make X-axis remaps appear unchanged on listeners.
      onRotationChange({
        yaw: yawOffset,
        xRotation: xRotationOffset,
        zRotation: zRotationOffset,
      });
    }
  });

  return (
    <group ref={orbGroupRef}>
      {showRotationAxes && <axesHelper args={[settings.radius * 1.45]} />}
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
