import { MeshStandardMaterialProps, SphereGeometryProps, useLoader } from '@react-three/fiber';
import React from 'react';
import { TextureLoader } from 'three';

const ModelEnv: React.FC<{ texturePath: string, geometryProps?: SphereGeometryProps, materialProps?: MeshStandardMaterialProps } & JSX.IntrinsicElements['mesh']> = ({ texturePath, geometryProps, materialProps, ...meshProps }) => {
  const texture = useLoader(TextureLoader, texturePath);
  
  return (
    <mesh {...meshProps}>
      <sphereGeometry args={[5, 32, 32]} {...geometryProps} />
      <meshStandardMaterial map={texture} side={2} {...materialProps} />
    </mesh>
  );
};

export default ModelEnv;
