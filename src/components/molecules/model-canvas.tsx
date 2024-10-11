"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Text3D } from "@react-three/drei";
import ModelLoader from "../atoms/model-loader";
import { GLTF } from "three/examples/jsm/Addons.js";
import { Move } from "../atoms/model-arrow";
import ModelEnv from "../atoms/model-env";
import { CONFIG, ProjectId, SUPABASE_URL } from "@/config/config";
import {
  BufferGeometry,
  Material,
  Mesh,
  NormalBufferAttributes,
  TextureLoader,
} from "three";
import { usePathname } from "next/navigation";

type GLTFResult = GLTF & {
  nodes: any;
  materials: any;
};

const ModelCanvas: React.FC<{
  projectId: ProjectId;
  imageId: string; // this imageId is provided from server. It is unused at the moment
  className?: string; // default: full screen
  withSubtitle?: boolean;
  doubleBy?: number; // two columns, specify the number of images to be skipped if the canvas is for the 2nd texture on the right column
}> = ({ projectId, imageId, className, withSubtitle, doubleBy }) => {
  const pathname = usePathname();
  const currentIndexToPathname =
    pathname.split("/")[pathname.split("/").length - 1];

  // State management to control the current model, this state is controlled by <Move /> as well
  const [currentModel, setCurrentModel] = useState<number>(
    doubleBy
      ? doubleBy + parseInt(currentIndexToPathname)
      : parseInt(currentIndexToPathname),
  );

  useEffect(() => {
    setCurrentModel(
      doubleBy
        ? doubleBy + parseInt(currentIndexToPathname)
        : parseInt(currentIndexToPathname),
    );
  }, [pathname]);

  const moveProps = {
    projectId: projectId,
    currentModel: currentModel,
    onMove: setCurrentModel,
  };

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

    // Preload some textures
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

  const textRef = useRef<Mesh<
    BufferGeometry<NormalBufferAttributes>,
    Material | Material[]
  > | null>(null); // Use null instead of undefined

  return (
    <Canvas
      className={className ?? "fixed left-0 top-0 h-screen w-screen"}
      gl={{
        toneMappingExposure: 4,
      }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} />
        <Suspense fallback={<ModelLoader />}>
          {/* Sphere where image is textured */}
          <ModelEnv
            rotation={[0, Math.PI / 2, 0]}
            projectId={projectId}
            textureIdx={currentModel}
            scale={[-1, 1, 1]}
          />
          {/* Subtitle */}
          {withSubtitle && CONFIG[projectId].text[currentModel] && (
            <group>
              {/* Text */}
              {/* <Text3D
                ref={textRef}
                font="/fonts/Arial.json"
                size={0.15}
                height={0.005}
                curveSegments={20}
                position={[-3, 3, 0]} // Position in 3D space
              >
                {CONFIG[projectId].text[currentModel]}
                <meshStandardMaterial color="black" />{" "}
              </Text3D> */}

              <Text
                // font="/fonts/Arial.json"
                fontSize={0.2}
                position={[0, 3.5, 0]} // Position in 3D space
              >
                {CONFIG[projectId].text[currentModel]}
                <meshStandardMaterial color="black" />{" "}
              </Text>
            </group>
          )}
        </Suspense>
        {/* Arrows to navigate */}
        {Object.keys(CONFIG[projectId].arrows).includes(
          currentModel.toString(),
        ) ? (
          CONFIG[projectId].arrows[currentModel].map(
            ([direction, value], idx) => {
              return (
                <Move
                  direction={direction}
                  value={value}
                  {...moveProps}
                  key={idx}
                />
              );
            },
          )
        ) : (
          // Default Arrows
          <>
            <Move direction={"up"} value={-1} {...moveProps} />
            <Move direction={"down"} value={1} {...moveProps} />
          </>
        )}
        <OrbitControls maxDistance={5} />
      </Suspense>
    </Canvas>
  );
};

export default ModelCanvas;
