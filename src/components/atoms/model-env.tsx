import {
  MeshBasicMaterialProps,
  SphereGeometryProps,
} from "@react-three/fiber";
import React from "react";
import { Texture } from "three";

const ModelEnv: React.FC<
  {
    texture: Texture;
    geometryProps?: SphereGeometryProps;
    materialProps?: MeshBasicMaterialProps;
  } & JSX.IntrinsicElements["mesh"]
> = ({ texture, geometryProps, materialProps, ...meshProps }) => {
  return (
    <mesh {...meshProps}>
      <sphereGeometry args={[5, 32, 32]} {...geometryProps} />
      <meshBasicMaterial map={texture} side={2} {...materialProps} />
    </mesh>
  );
};

export default ModelEnv;
