import { Html, useProgress } from "@react-three/drei";
import React from "react";

const ModelLoader: React.FC = () => {
  const { progress } = useProgress();
  const pct = Math.round(progress);

  return (
    <Html center>
      <div
        style={{
          width: 280,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "center",
          fontFamily: "sans-serif",
          color: "#374151",
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: 13, letterSpacing: "0.08em", opacity: 0.7 }}>
          LOADING
        </div>
        <div
          style={{
            width: "100%",
            height: 4,
            background: "rgba(0,0,0,0.12)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "#374151",
              borderRadius: 2,
              transition: "width 0.2s ease",
            }}
          />
        </div>
        <div style={{ fontSize: 12, opacity: 0.5 }}>{pct}%</div>
      </div>
    </Html>
  );
};

export default ModelLoader;
