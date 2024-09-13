"use client";

import React, { Suspense, useEffect, useState } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import ModelLoader from "../atoms/model-loader";
import { GLTF } from "three/examples/jsm/Addons.js";
import { Move } from "../atoms/model-arrow";
import ModelEnv from "../atoms/model-env";
import { CONFIG, ProjectId, SUPABASE_URL } from "@/config/config";
import { useModelContext } from "@/contexts/model-context";
import { TextureLoader } from "three";
import useDeviceDetect from "@/hooks/useDeviceDetect";

type GLTFResult = GLTF & {
  nodes: any;
  materials: any;
};

const ModelCanvas: React.FC<{ projectId: ProjectId; imageId: string }> = ({
  projectId,
  imageId,
}) => {
  const { currentModel, setCurrentModel } = useModelContext();
  const { isMobile } = useDeviceDetect();
  // const [progress, setProgress] = useState(0);

  // update based on pathname
  useEffect(() => {
    setCurrentModel(parseInt(imageId));
  }, [imageId]);
  // const texture = useLoader(TextureLoader, "/test.jpg");

  // preload 2 images ahead
  useEffect(() => {
    const loader = new TextureLoader();

    const loadTexture = (url: string) => {
      // console.log("🏁 Now loading:", url);
      return new Promise<void>((resolve, reject) => {
        loader.load(
          url,
          () => {
            resolve();
          },
          undefined,
          (err) => {
            console.error("Error loading texture:", url, err);
            reject(err);
          },
        );
      });
    };

    const loadAllTextures = async () => {
      for (const url of textureUrls.slice(
        (currentModel - 2) % textureUrls.length,
        (currentModel + 2) % textureUrls.length,
      )) {
        await loadTexture(url);
      }
      // console.log("📍 All textures loaded!");
    };

    // Start loading the textures
    loadAllTextures();
  }, [currentModel]);

  const getPath = (textureIdx: number) => {
    return (
      SUPABASE_URL +
      CONFIG[projectId].supabaseFolder +
      "/" +
      CONFIG[projectId].supabasePrefixPath +
      "_" +
      textureIdx +
      ".jpg"
    );
  };

  const textureUrls = Array(CONFIG[projectId].numberOfImages)
    .fill(null)
    .map((_, idx) => getPath(idx + 1));

  return (
    <Canvas
      className="fixed left-0 top-0 h-screen w-screen"
      gl={{
        toneMappingExposure: 4,
      }}
      // style={{
      //   width: "100vw",
      //   height: isMobile ? "100dvh" : "100vh",
      // }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} />
        <Suspense fallback={<ModelLoader />}>
          <ModelEnv
            rotation={[0, Math.PI / 2, 0]}
            projectId={projectId}
            textureIdx={currentModel}
            scale={[-1, 1, 1]}
          />

          {/* {progress >= textureUrls.length ? (
            <ModelEnv
              rotation={[0, Math.PI / 2, 0]}
              projectId={projectId}
              textureIdx={currentModel}
              scale={[-1, 1, 1]}
            />
          ) : (
            <>
              <Html>
                <div>
                  <div className="relative">
                    <div className="absolute z-0 h-5 w-[300px] bg-black" />
                    <div
                      className="z-1 absolute h-5 bg-white transition-all duration-500"
                      style={{ width: (progress / 69) * 300 }}
                    >
                      {progress} / 69 Loading...🚶
                    </div>
                  </div>
                </div>
              </Html>
            </>
          )} */}

          {/* <mesh scale={[-1, 1, 1]} rotation={[0, Math.PI/2, 0]}>
            <sphereGeometry args={[5, 32, 32]}   />
            <meshBasicMaterial map={texture} side={2}  />
          </mesh> */}
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
