import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import { Server as IOServer } from "socket.io";

type NextApiResponseServerIO = NextApiResponse & {
  socket: NextApiResponse["socket"] & {
    server: HTTPServer & {
      io?: IOServer;
    };
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponseServerIO,
) {
  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server, {
      path: "/api/orb-ws/socket.io",
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      socket.on("orb:rotation", (payload: unknown) => {
        if (!payload || typeof payload !== "object") {
          return;
        }

        const data = payload as {
          clientId?: unknown;
          yaw?: unknown;
          xRotation?: unknown;
          zRotation?: unknown;
        };
        const clientId =
          typeof data.clientId === "string" ? data.clientId.trim() : "";
        if (!clientId.length || clientId.length > 64) {
          return;
        }
        if (!isFiniteNumber(data.yaw) || !isFiniteNumber(data.xRotation)) {
          return;
        }
        const zRotation = isFiniteNumber(data.zRotation) ? data.zRotation : 0;

        io.emit("orb:rotation", {
          clientId,
          yaw: data.yaw,
          xRotation: data.xRotation,
          zRotation,
          timestamp: Date.now(),
        });
      });
    });

    res.socket.server.io = io;
  }

  res.status(200).json({ ok: true });
}
