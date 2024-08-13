'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { DeviceOrientationControls, OrbitControls } from '@react-three/drei';
import ModelLoader from '../atoms/model-loader';
import { GLTF } from 'three/examples/jsm/Addons.js';
import { ArrowBackward, ArrowForward } from '../atoms/model-arrow';
import { useModelContext } from '@/contexts/model-context';
import { PATHS } from '@/config/paths';
import ModelEnv from '../atoms/model-env';

type GLTFResult = GLTF & {
  nodes: any;
  materials: any;
};

const ModelCanvas: React.FC = () => {
  const { currentModel } = useModelContext()

  return (
    <Canvas 
      className="fixed top-0 left-0 w-screen h-screen"
    >
      <Suspense fallback={null}>
        <ambientLight intensity={1} />
        <directionalLight position={[5, 5, 5]} />
          <Suspense fallback={<ModelLoader />}>
              <ModelEnv 
                rotation={[0, Math.PI/2, 0]}
                texturePath={PATHS[currentModel]}  
              />
          </Suspense>
          <ArrowForward />
          <ArrowBackward />
          <OrbitControls />
        {/* <DeviceOrientationControls /> */}
      </Suspense>
    </Canvas>
  );
};

export default ModelCanvas;
