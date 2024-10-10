import { Html, useProgress } from "@react-three/drei";
import React from "react";

const ModelLoader: React.FC = () => {
  const { progress } = useProgress();
  return (
    <Html center className="w-screen text-center">
      🏃‍♀️ {progress}% {Array.from({ length: progress }, () => "💨")}
    </Html>
  );
};

export default ModelLoader;
