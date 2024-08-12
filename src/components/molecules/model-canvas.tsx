'use client';

import React, { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { DeviceOrientationControls, OrbitControls } from '@react-three/drei';
import ModelLoader from '../atoms/model-loader';
import { GLTF } from 'three/examples/jsm/Addons.js';
import Model from '../atoms/model';
import { ArrowBackward, ArrowForward } from '../atoms/model-arrow';
import { useModelContext } from '@/contexts/model-context';
import { PATHS } from '@/config/paths';

type GLTFResult = GLTF & {
  nodes: any;
  materials: any;
};

const ModelCanvas: React.FC = () => {
  const { currentModel } = useModelContext()

  useEffect(()=>{
    console.log('curre model', currentModel)
  }, [currentModel])

  return (
    <Canvas className="fixed top-0 left-0 w-screen h-screen">
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} />
        <Suspense fallback={<ModelLoader />}>
                      <Model key={currentModel} path={PATHS[currentModel]} />

          {/* {Array.from({ length: 2 }).map((_, idx) => (
              <Model key={idx} path={path[idx]} />
            ))} */}
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
