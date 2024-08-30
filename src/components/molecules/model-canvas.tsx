"use client";

import React, { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import ModelLoader from "../atoms/model-loader";
import { GLTF } from "three/examples/jsm/Addons.js";
import { Move } from "../atoms/model-arrow";
import ModelEnv from "../atoms/model-env";
import { CONFIG, ProjectId } from "@/config/config";
import { useModelContext } from "@/contexts/model-context";

type GLTFResult = GLTF & {
  nodes: any;
  materials: any;
};

const ModelCanvas: React.FC<{ projectId: ProjectId; imageId: string }> = ({
  projectId,
  imageId,
}) => {
  const { currentModel, setCurrentModel } = useModelContext();
  // update based on pathname
  useEffect(() => {
    setCurrentModel(parseInt(imageId))
  }, [imageId])

  return (
    <Canvas className="fixed left-0 top-0 h-screen w-screen">
      <Suspense fallback={null}>
        <ambientLight intensity={1} />
        <directionalLight position={[5, 5, 5]} />
        <Suspense fallback={<ModelLoader />}>
          <ModelEnv
            rotation={[0, Math.PI / 2, 0]}
            projectId={projectId}
            textureIdx={currentModel}
            scale={[-1, 1, 1]}
          />
        </Suspense>
        {Object.keys(CONFIG[projectId].arrows).includes(
          currentModel.toString(),
        ) ? (
          CONFIG[projectId].arrows[currentModel].map(
            ([direction, value], idx) => {
              return (
                <Move
                  projectId={projectId}
                  direction={direction}
                  value={value}
                  key={idx}
                />
              );
            },
          )
        ) : (
          // Default Arrows
          <>
            <Move projectId={projectId} direction={"up"} value={-1} />
            <Move projectId={projectId} direction={"down"} value={1} />
          </>
        )}
        <OrbitControls maxDistance={5} />
      </Suspense>
    </Canvas>
  );
};

export default ModelCanvas;
