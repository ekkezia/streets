"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
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
import SubtitleText from './subtitle-text';

type GLTFResult = GLTF & {
  nodes: any;
  materials: any;
};

const ModelCanvas: React.FC<{
  projectId: ProjectId;
  imageId: string; // this imageId is provided from server. It is unused at the moment
  className?: string; // default: full screen
  withSubtitle?: boolean;
  column?: '1' | '2';
  doubleBy?: number; // two columns, specify the number of images to be skipped if the canvas is for the 2nd texture on the right column
  scale?: number[]
}> = ({ projectId, imageId, className, withSubtitle, column, doubleBy, scale }) => {
  const pathname = usePathname();
  const currentIndexToPathname =
    pathname.split("/").length <= 2
      ? "1"
      : pathname.split("/")[pathname.split("/").length - 1];

  // State management to control the current model, this state is controlled by <Move /> as well
  const [currentModel, setCurrentModel] = useState<number>(
    doubleBy
      ? (doubleBy + parseInt(currentIndexToPathname)) % 44
      : parseInt(currentIndexToPathname),
  );

  useEffect(() => {
    setCurrentModel(parseInt(currentIndexToPathname));
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

  // Two Columns Style
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsSmallScreen(window.innerWidth < 425);
      const handleResize = () => setIsSmallScreen(window.innerWidth < 425);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  const style: Record<string, React.CSSProperties> = {
    "1": {
        position: "fixed",
        width: isSmallScreen ? "100vw" : "50vw",
        height: isSmallScreen ? "50vh" : "100vh",
        top: 0,
        left: isSmallScreen ? 0 : '50vw',
    },
  "2": {
        position: "fixed",
        width: isSmallScreen ? "100vw" : "50vw",
        height: isSmallScreen ? "50vh" : "100vh",
        top: isSmallScreen ? "50vh" : 0,
        left: 0,
    }
  }

  return (
    <Canvas
      style={column && style[column]}
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
            textureIdx={doubleBy ? doubleBy + currentModel : currentModel}
            scale={scale ?? [-1, 1, 1]}
          />
          {/* Subtitle */}
          {withSubtitle && CONFIG[projectId].text[currentModel] && (
            <SubtitleText>                
              {CONFIG[projectId].text[currentModel]}
            </SubtitleText>
          )}
        </Suspense>
        {/* Arrows to navigate */}
        {Object.keys(CONFIG[projectId].arrows).includes(
          currentModel.toString(),
        ) ? (
          CONFIG[projectId].arrows[currentModel].map(
            ([direction, value, tooltip], idx) => {
              return (
                <Move
                  direction={direction}
                  value={value}
                  tooltip={tooltip}
                  {...moveProps}
                  key={idx}
                />
              );
            },
          )
        ) : (
          // Default Arrows
          <>
            <Move 
              direction={"reverse"} 
              value={-1}                   
              tooltip={null}
              {...moveProps} 
            />
            <Move 
              direction={"forward"} 
              value={1}                   
              tooltip={null}
              {...moveProps} 
            />
          </>
        )}
        <OrbitControls maxDistance={5} />
      </Suspense>
    </Canvas>
  );
};

export default ModelCanvas;
