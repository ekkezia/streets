"use client";

import React, { useEffect, useRef } from "react";

export type TrackedSubject = {
  sourceId: string;
  x: number;
  y: number;
  z: number;
  confidence: number;
  lastUpdated: number;
};

type SubjectPresenceProps = {
  enabled: boolean;
  cameraEnabled: boolean;
  cameraDeviceId?: string;
  flipX?: boolean;
  flipY?: boolean;
  debugEnabled?: boolean;
  cameraBackdropEnabled?: boolean;
  cameraBackdropOpacity?: number;
  onSubjectsChange: (subjects: TrackedSubject[]) => void;
  websocketUrl?: string;
};

const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MEDIAPIPE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const SUBJECT_TTL_MS = 3500;
const SEND_INTERVAL_MS = 80;
const POSITION_SMOOTHING = 0.35;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, alpha: number) =>
  from + (to - from) * alpha;

const SubjectPresence: React.FC<SubjectPresenceProps> = ({
  enabled,
  cameraEnabled,
  cameraDeviceId,
  flipX = false,
  flipY = false,
  debugEnabled = false,
  cameraBackdropEnabled = false,
  cameraBackdropOpacity = 0.66,
  onSubjectsChange,
  websocketUrl,
}) => {
  const sourceIdRef = useRef(`subject-${Math.random().toString(36).slice(2, 10)}`);
  const videoRef = useRef<HTMLVideoElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const backdropCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!enabled) {
      onSubjectsChange([]);
      return;
    }

    const videoElement = videoRef.current;
    let disposed = false;
    let rafId = 0;
    let staleTimer: number | undefined;
    let mediaStream: MediaStream | null = null;
    let poseLandmarker:
      | {
          detectForVideo: (video: HTMLVideoElement, timestamp: number) => {
            landmarks?: Array<Array<{ x: number; y: number; z: number; visibility?: number }>>;
          };
          close: () => void;
        }
      | null = null;
    let ws: WebSocket | null = null;
    let lastSentAt = 0;

    const subjectsMap = new Map<string, TrackedSubject>();
    const debugFrameSize = { width: 320, height: 240 };

    const drawVideoFrame = (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      useCoverFit: boolean,
    ) => {
      const videoWidth = videoElement?.videoWidth || 640;
      const videoHeight = videoElement?.videoHeight || 480;

      ctx.save();
      if (flipX || flipY) {
        ctx.translate(flipX ? canvas.width : 0, flipY ? canvas.height : 0);
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      }

      if (!useCoverFit) {
        ctx.drawImage(videoElement as HTMLVideoElement, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        return;
      }

      const videoAspect = videoWidth / videoHeight;
      const canvasAspect = canvas.width / canvas.height;
      let drawWidth = canvas.width;
      let drawHeight = canvas.height;
      let offsetX = 0;
      let offsetY = 0;

      if (videoAspect > canvasAspect) {
        drawHeight = canvas.height;
        drawWidth = drawHeight * videoAspect;
        offsetX = (canvas.width - drawWidth) / 2;
      } else {
        drawWidth = canvas.width;
        drawHeight = drawWidth / videoAspect;
        offsetY = (canvas.height - drawHeight) / 2;
      }

      ctx.drawImage(
        videoElement as HTMLVideoElement,
        offsetX,
        offsetY,
        drawWidth,
        drawHeight,
      );
      ctx.restore();
    };

    const drawBackdropFrame = () => {
      if (!cameraBackdropEnabled || !videoElement || !backdropCanvasRef.current) {
        return;
      }

      const canvas = backdropCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.max(1, Math.round(window.innerWidth * dpr));
      const nextHeight = Math.max(1, Math.round(window.innerHeight * dpr));

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawVideoFrame(ctx, canvas, true);

      // Feather out all edges so the camera backdrop dissolves softly
      // instead of showing a rectangular hard border.
      const width = canvas.width;
      const height = canvas.height;
      const edgeFeather = Math.max(
        Math.round(Math.min(width, height) * 0.2),
        Math.round(56 * dpr),
      );

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";

      const leftFade = ctx.createLinearGradient(0, 0, edgeFeather, 0);
      leftFade.addColorStop(0, "rgba(0,0,0,1)");
      leftFade.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = leftFade;
      ctx.fillRect(0, 0, edgeFeather, height);

      const rightFade = ctx.createLinearGradient(width, 0, width - edgeFeather, 0);
      rightFade.addColorStop(0, "rgba(0,0,0,1)");
      rightFade.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rightFade;
      ctx.fillRect(width - edgeFeather, 0, edgeFeather, height);

      const topFade = ctx.createLinearGradient(0, 0, 0, edgeFeather);
      topFade.addColorStop(0, "rgba(0,0,0,1)");
      topFade.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = topFade;
      ctx.fillRect(0, 0, width, edgeFeather);

      const bottomFade = ctx.createLinearGradient(0, height, 0, height - edgeFeather);
      bottomFade.addColorStop(0, "rgba(0,0,0,1)");
      bottomFade.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bottomFade;
      ctx.fillRect(0, height - edgeFeather, width, edgeFeather);

      const centerX = width / 2;
      const centerY = height / 2;
      const radialFade = ctx.createRadialGradient(
        centerX,
        centerY,
        Math.min(width, height) * 0.36,
        centerX,
        centerY,
        Math.max(width, height) * 0.78,
      );
      radialFade.addColorStop(0, "rgba(0,0,0,0)");
      radialFade.addColorStop(0.64, "rgba(0,0,0,0)");
      radialFade.addColorStop(0.82, "rgba(0,0,0,0.42)");
      radialFade.addColorStop(0.94, "rgba(0,0,0,0.78)");
      radialFade.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = radialFade;
      ctx.fillRect(0, 0, width, height);

      ctx.restore();
    };

    const drawDebugFrame = (subject: TrackedSubject | null) => {
      if (!debugEnabled || !videoElement || !debugCanvasRef.current) {
        return;
      }

      const canvas = debugCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      if (
        canvas.width !== debugFrameSize.width ||
        canvas.height !== debugFrameSize.height
      ) {
        canvas.width = debugFrameSize.width;
        canvas.height = debugFrameSize.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawVideoFrame(ctx, canvas, false);

      // Center cross for quick visual calibration.
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 10, canvas.height / 2);
      ctx.lineTo(canvas.width / 2 + 10, canvas.height / 2);
      ctx.moveTo(canvas.width / 2, canvas.height / 2 - 10);
      ctx.lineTo(canvas.width / 2, canvas.height / 2 + 10);
      ctx.stroke();

      if (!subject) {
        return;
      }

      const px = clamp(subject.x, 0, 1) * canvas.width;
      const py = clamp(subject.y, 0, 1) * canvas.height;

      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,247,255,0.35)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,247,255,0.95)";
      ctx.stroke();

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(8, 8, 122, 24);
      ctx.fillStyle = "white";
      ctx.font = "12px monospace";
      ctx.fillText(`x:${subject.x.toFixed(2)} y:${subject.y.toFixed(2)}`, 12, 24);
    };

    const emitSubjects = () => {
      onSubjectsChange(Array.from(subjectsMap.values()));
    };

    const upsertSubject = (subject: TrackedSubject) => {
      subjectsMap.set(subject.sourceId, subject);
      emitSubjects();
    };

    const resolveWebsocketUrl = () => {
      if (websocketUrl) {
        return websocketUrl;
      }

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      return `${protocol}://${window.location.host}/ws/subject`;
    };

    const parseIncomingSubject = (payload: unknown): TrackedSubject | null => {
      if (!payload || typeof payload !== "object") {
        return null;
      }

      const record = payload as Record<string, unknown>;
      if (record.type !== "subject_pose") {
        return null;
      }

      if (typeof record.sourceId !== "string") {
        return null;
      }

      const now = Date.now();
      const x = clamp(Number(record.x ?? 0.5), 0, 1);
      const y = clamp(Number(record.y ?? 0.5), 0, 1);
      const z = clamp(Number(record.z ?? 0), -2, 2);
      const confidence = clamp(Number(record.confidence ?? 0), 0, 1);

      return {
        sourceId: record.sourceId,
        x,
        y,
        z,
        confidence,
        lastUpdated: now,
      };
    };

    try {
      ws = new WebSocket(resolveWebsocketUrl());

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data));
          const subject = parseIncomingSubject(parsed);

          if (subject) {
            upsertSubject(subject);
          }
        } catch {
          // Ignore malformed socket payloads.
        }
      };
    } catch {
      // Ignore websocket setup failures and continue local tracking.
    }

    staleTimer = window.setInterval(() => {
      const now = Date.now();
      let changed = false;

      subjectsMap.forEach((subject, key) => {
        if (now - subject.lastUpdated > SUBJECT_TTL_MS) {
          subjectsMap.delete(key);
          changed = true;
        }
      });

      if (changed) {
        emitSubjects();
      }
    }, 1000);

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        return;
      }

      const baseVideoConstraints = {
        width: { ideal: 640 },
        height: { ideal: 480 },
      };

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: cameraDeviceId
            ? {
                ...baseVideoConstraints,
                deviceId: { exact: cameraDeviceId },
              }
            : {
                ...baseVideoConstraints,
                facingMode: "user",
              },
          audio: false,
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...baseVideoConstraints,
            facingMode: "user",
          },
          audio: false,
        });
      }

      if (!videoElement || disposed) {
        return;
      }

      videoElement.srcObject = mediaStream;
      await videoElement.play();

      const { FilesetResolver, PoseLandmarker } = await import(
        "@mediapipe/tasks-vision"
      );

      if (disposed) {
        return;
      }

      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

      if (disposed) {
        return;
      }

      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      if (disposed) {
        return;
      }

      const trackFrame = () => {
        if (disposed || !poseLandmarker || !videoElement) {
          return;
        }

        if (videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          drawBackdropFrame();
          const nowPerf = performance.now();
          const result = poseLandmarker.detectForVideo(videoElement, nowPerf);
          const landmarks = result.landmarks?.[0];

          if (landmarks?.length) {
            const nose = landmarks[0];
            const leftHip = landmarks[23];
            const rightHip = landmarks[24];
            const leftShoulder = landmarks[11];
            const rightShoulder = landmarks[12];
            const shoulderCenter =
              leftShoulder && rightShoulder
                ? {
                    x: (leftShoulder.x + rightShoulder.x) / 2,
                    y: (leftShoulder.y + rightShoulder.y) / 2,
                    z: (leftShoulder.z + rightShoulder.z) / 2,
                    visibility: Math.min(
                      leftShoulder.visibility ?? 0,
                      rightShoulder.visibility ?? 0,
                    ),
                  }
                : null;
            const hipCenter =
              leftHip && rightHip
                ? {
                    x: (leftHip.x + rightHip.x) / 2,
                    y: (leftHip.y + rightHip.y) / 2,
                    z: (leftHip.z + rightHip.z) / 2,
                    visibility: Math.min(
                      leftHip.visibility ?? 0,
                      rightHip.visibility ?? 0,
                    ),
                  }
                : null;
            const bodyCenter =
              (nose && (nose.visibility ?? 1) > 0.2
                ? {
                    x: nose.x,
                    y: nose.y,
                    z: nose.z,
                    visibility: nose.visibility ?? 1,
                  }
                : shoulderCenter) ??
              hipCenter ?? { x: 0.5, y: 0.5, z: 0, visibility: 0 };

            const nextX = flipX
              ? 1 - clamp(bodyCenter.x, 0, 1)
              : clamp(bodyCenter.x, 0, 1);
            const nextY = flipY
              ? 1 - clamp(bodyCenter.y, 0, 1)
              : clamp(bodyCenter.y, 0, 1);
            const nextZ = clamp(bodyCenter.z, -2, 2);
            const nextConfidence = clamp(bodyCenter.visibility ?? 0, 0, 1);
            const previous = subjectsMap.get(sourceIdRef.current);

            const trackedSubject: TrackedSubject = {
              sourceId: sourceIdRef.current,
              x: previous
                ? lerp(previous.x, nextX, POSITION_SMOOTHING)
                : nextX,
              y: previous
                ? lerp(previous.y, nextY, POSITION_SMOOTHING)
                : nextY,
              z: previous
                ? lerp(previous.z, nextZ, POSITION_SMOOTHING)
                : nextZ,
              confidence: previous
                ? lerp(previous.confidence, nextConfidence, POSITION_SMOOTHING)
                : nextConfidence,
              lastUpdated: Date.now(),
            };

            upsertSubject(trackedSubject);
            drawDebugFrame(trackedSubject);

            if (
              ws?.readyState === WebSocket.OPEN &&
              nowPerf - lastSentAt >= SEND_INTERVAL_MS
            ) {
              ws.send(
                JSON.stringify({
                  type: "subject_pose",
                  sourceId: trackedSubject.sourceId,
                  x: trackedSubject.x,
                  y: trackedSubject.y,
                  z: trackedSubject.z,
                  confidence: trackedSubject.confidence,
                  timestamp: trackedSubject.lastUpdated,
                }),
              );
              lastSentAt = nowPerf;
            }
          } else {
            drawDebugFrame(null);
          }
        } else {
          drawBackdropFrame();
          drawDebugFrame(null);
        }

        rafId = window.requestAnimationFrame(trackFrame);
      };

      rafId = window.requestAnimationFrame(trackFrame);
    };

    if (cameraEnabled) {
      start().catch(() => {
        // Camera permission denied or MediaPipe initialization failed.
      });
    }

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);

      if (staleTimer) {
        window.clearInterval(staleTimer);
      }

      if (ws) {
        ws.close();
      }

      if (poseLandmarker) {
        poseLandmarker.close();
      }

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }

      if (videoElement) {
        videoElement.srcObject = null;
      }

      subjectsMap.clear();
      onSubjectsChange([]);
    };
  }, [
    cameraDeviceId,
    cameraEnabled,
    enabled,
    flipX,
    flipY,
    debugEnabled,
    cameraBackdropEnabled,
    onSubjectsChange,
    websocketUrl,
  ]);

  return (
    <>
      <video className="hidden" muted playsInline ref={videoRef} />
      {enabled && cameraBackdropEnabled && cameraEnabled && (
        <canvas
          className="pointer-events-none fixed inset-0 z-[5] h-screen w-screen"
          ref={backdropCanvasRef}
          style={{
            opacity: cameraBackdropOpacity,
            filter: "contrast(1.05) saturate(1.08)",
          }}
        />
      )}
      {enabled && debugEnabled && (
        <div className="fixed bottom-4 right-4 z-20 rounded-xl border border-white/20 bg-black/65 p-2 text-[11px] text-white backdrop-blur">
          <p className="mb-1 font-semibold uppercase tracking-[0.12em]">
            Tracking Debug
          </p>
          <canvas
            className="h-[180px] w-[240px] rounded-md border border-white/20 bg-black"
            ref={debugCanvasRef}
          />
          <p className="mt-1 text-white/70">
            {cameraEnabled ? "Camera active" : "Camera inactive"}
          </p>
        </div>
      )}
    </>
  );
};

export default SubjectPresence;
