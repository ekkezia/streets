import {
  MeshBasicMaterialProps,
  SphereGeometryProps,
  useFrame,
} from "@react-three/fiber";
import React, { useLayoutEffect, useRef, useState } from "react";
import { MeshBasicMaterial, Texture } from "three";

const TEXTURE_FADE_DURATION_SECONDS = 0.45;

const ModelEnv: React.FC<
  {
    texture: Texture;
    geometryProps?: SphereGeometryProps;
    materialProps?: MeshBasicMaterialProps;
  } & JSX.IntrinsicElements["mesh"]
> = ({ texture, geometryProps, materialProps, ...meshProps }) => {
  const currentMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const previousMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const currentTextureRef = useRef(texture);
  const fadeProgressRef = useRef(1);
  const [previousTexture, setPreviousTexture] = useState<Texture | null>(null);

  useLayoutEffect(() => {
    if (currentTextureRef.current === texture) {
      return;
    }

    setPreviousTexture(currentTextureRef.current);
    currentTextureRef.current = texture;
    fadeProgressRef.current = 0;

    if (currentMaterialRef.current) {
      currentMaterialRef.current.opacity = 0;
      currentMaterialRef.current.transparent = true;
      currentMaterialRef.current.needsUpdate = true;
    }

    if (previousMaterialRef.current) {
      previousMaterialRef.current.opacity = 1;
      previousMaterialRef.current.transparent = true;
      previousMaterialRef.current.needsUpdate = true;
    }
  }, [texture]);

  useFrame((_, delta) => {
    if (!currentMaterialRef.current || fadeProgressRef.current >= 1) {
      return;
    }

    const step = delta / TEXTURE_FADE_DURATION_SECONDS;
    const nextProgress = Math.min(1, fadeProgressRef.current + step);
    fadeProgressRef.current = nextProgress;

    currentMaterialRef.current.opacity = nextProgress;
    currentMaterialRef.current.needsUpdate = true;

    if (previousMaterialRef.current) {
      previousMaterialRef.current.opacity = 1 - nextProgress;
      previousMaterialRef.current.needsUpdate = true;
    }

    if (nextProgress >= 1) {
      setPreviousTexture(null);
    }
  });

  return (
    <>
      {previousTexture && (
        <mesh {...meshProps} renderOrder={0}>
          <sphereGeometry args={[5, 32, 32]} {...geometryProps} />
          <meshBasicMaterial
            {...materialProps}
            ref={previousMaterialRef}
            map={previousTexture}
            side={2}
            transparent
            depthWrite={false}
            opacity={1}
          />
        </mesh>
      )}
      <mesh {...meshProps} renderOrder={1}>
        <sphereGeometry args={[5, 32, 32]} {...geometryProps} />
        <meshBasicMaterial
          {...materialProps}
          ref={currentMaterialRef}
          map={texture}
          side={2}
          transparent
          depthWrite={false}
          opacity={1}
        />
      </mesh>
    </>
  );
};

export default ModelEnv;
