'use client';

import React from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';

const Model: React.FC<{ path: string }> = ({ path }) => {
  const { scene } = useLoader(GLTFLoader, path);
  return <primitive object={scene} />;
};

export default Model