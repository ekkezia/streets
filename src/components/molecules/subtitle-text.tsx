"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {  Text3D } from "@react-three/drei";

const SubtitleText: React.FC<{
  children: string;
}> = ({ children }) => {
  const textRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>>(null);
  const [textWidth, setTextWidth] = useState(0);
  const [textHeight, setTextHeight] = useState(0);

  useEffect(() => {
    if (textRef.current) {
      const boundingBox = new THREE.Box3().setFromObject(textRef.current);
      const width = boundingBox.max.x - boundingBox.min.x;
      const height = boundingBox.max.y - boundingBox.min.y;
      setTextWidth(width);
      setTextHeight(height);
    }
  }, [textRef]);


  return (
            <group>
              <mesh position={[0, 2.6, -0.1]} scale={[textWidth + 0.6, textHeight + 0.2, 0.1]}>
                <boxGeometry />
                <meshStandardMaterial color="lightgray" />
              </mesh>

              <Text3D
                font="/fonts/arial.json"
                size={0.15}
                height={0.02}
                position={[-textWidth / 2, 2.5, 0]} 
                ref={textRef}
              >
                {children}
                <meshStandardMaterial color="black" />
              </Text3D>
            </group>
  );
};

export default SubtitleText;
