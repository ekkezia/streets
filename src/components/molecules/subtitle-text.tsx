"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {  Text3D } from "@react-three/drei";
import { usePathname } from 'next/navigation';
import { useLanguageContext } from '@/contexts/language-context';

const SubtitleText: React.FC<{
  children: {
    [key: string]: string;
  };
}> = ({ children }) => {
  const { currentLanguage } = useLanguageContext();

  const textRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>>(null);
  const [textWidth, setTextWidth] = useState(0);
  const [textHeight, setTextHeight] = useState(0);

  const path = usePathname()

  useEffect(() => {
    if (textRef.current) {
      const boundingBox = new THREE.Box3().setFromObject(textRef.current);
      const width = boundingBox.max.x - boundingBox.min.x;
      const height = boundingBox.max.y - boundingBox.min.y;
      setTextWidth(width);
      setTextHeight(height);
    }
          // console.log('path', children["en"])

  }, [textRef, path, currentLanguage]);


  return (
            <group>
              <mesh position={[0, 2.6, -0.001]} scale={[textWidth + 0.6, textHeight + 0.2, 0]}>
                <boxGeometry />
                <meshStandardMaterial color="lightgray" />
              </mesh>

              <Text3D
                font="/fonts/arial.json"
                size={0.15}
                height={0.0}
                position={[-textWidth / 2, 2.5, 0]} 
                ref={textRef}
              >
                {currentLanguage ? children[currentLanguage] : children["en"]}
                <meshStandardMaterial color="black" />
              </Text3D>
            </group>
  );
};

export default SubtitleText;
