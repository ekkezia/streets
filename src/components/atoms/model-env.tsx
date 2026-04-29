import {
  MeshBasicMaterialProps,
  SphereGeometryProps,
  useFrame,
} from "@react-three/fiber";
import React, { useEffect, useRef } from "react";
import { MeshBasicMaterial, Texture } from "three";

const TEXTURE_FADE_DURATION_SECONDS = 0.6;

const ModelEnv: React.FC<
  {
    texture: Texture;
    geometryProps?: SphereGeometryProps;
    materialProps?: MeshBasicMaterialProps;
  } & JSX.IntrinsicElements["mesh"]
> = ({ texture, geometryProps, materialProps, ...meshProps }) => {
  const materialRef = useRef<MeshBasicMaterial | null>(null);

  useEffect(() => {
    if (!materialRef.current) {
      return;
    }
    materialRef.current.opacity = 0;
    materialRef.current.transparent = true;
    materialRef.current.needsUpdate = true;
  }, [texture]);

  useFrame((_, delta) => {
    if (!materialRef.current) {
      return;
    }

    const step = delta / TEXTURE_FADE_DURATION_SECONDS;
    const nextOpacity = Math.min(1, materialRef.current.opacity + step);
    if (nextOpacity !== materialRef.current.opacity) {
      materialRef.current.opacity = nextOpacity;
      materialRef.current.needsUpdate = true;
    }
  });

  return (
    <mesh {...meshProps}>
      <sphereGeometry args={[5, 32, 32]} {...geometryProps} />
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        side={2}
        transparent
        opacity={1}
        {...materialProps}
      />
    </mesh>
  );
};

export default ModelEnv;
