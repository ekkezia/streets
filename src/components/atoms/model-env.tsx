import { CONFIG, ProjectId } from "@/config/config";
import { SUPABASE_URL } from "@/config/config";
import {
  MeshStandardMaterialProps,
  SphereGeometryProps,
  useLoader,
} from "@react-three/fiber";
import React from "react";
import { TextureLoader } from "three";

const ModelEnv: React.FC<
  {
    projectId: ProjectId;
    textureIdx: number;
    geometryProps?: SphereGeometryProps;
    materialProps?: MeshStandardMaterialProps;
  } & JSX.IntrinsicElements["mesh"]
> = ({ projectId, textureIdx, geometryProps, materialProps, ...meshProps }) => {
  const path =
    SUPABASE_URL +
    CONFIG[projectId].supabaseFolder +
    "/" +
    CONFIG[projectId].supabasePrefixPath +
    "_" +
    textureIdx +
    ".jpg";
  const texture = useLoader(TextureLoader, path);

  return (
    <mesh {...meshProps}>
      <sphereGeometry args={[5, 32, 32]} {...geometryProps} />
      <meshBasicMaterial map={texture} side={2} />
    </mesh>
  );
};

export default ModelEnv;
