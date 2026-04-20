const http = require("http");
const next = require("next");
const { WebSocketServer } = require("ws");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const SOCKET_OPEN = 1;

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      handle(req, res);
    });

    const wss = new WebSocketServer({ noServer: true });
    const sockets = new Set();
    const socketClientIds = new WeakMap();
    let orbParentClientId = null;

    const broadcast = (payload) => {
      const message = JSON.stringify(payload);

      sockets.forEach((client) => {
        if (client.readyState === SOCKET_OPEN) {
          client.send(message);
        }
      });
    };

    const send = (socket, payload) => {
      if (socket.readyState !== SOCKET_OPEN) {
        return;
      }

      socket.send(JSON.stringify(payload));
    };

    const sanitizeClientId = (value) => {
      if (typeof value !== "string") {
        return null;
      }

      const trimmed = value.trim();
      if (!trimmed.length) {
        return null;
      }

      return trimmed.slice(0, 64);
    };

    const broadcastParentStatus = () => {
      broadcast({
        type: "orb_parent_status",
        parentId: orbParentClientId,
        timestamp: Date.now(),
      });
    };

    const releaseParentIfOwned = (clientId) => {
      if (!clientId || orbParentClientId !== clientId) {
        return;
      }

      orbParentClientId = null;
      broadcastParentStatus();
    };

    wss.on("connection", (socket) => {
      sockets.add(socket);
      send(socket, {
        type: "orb_parent_status",
        parentId: orbParentClientId,
        timestamp: Date.now(),
      });

      socket.on("message", (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          const messageType = data?.type;

          if (messageType === "subject_pose") {
            const sourceId =
              typeof data.sourceId === "string" && data.sourceId.trim().length
                ? data.sourceId.trim().slice(0, 64)
                : "anonymous";

            const payload = {
              type: "subject_pose",
              sourceId,
              x: clamp(Number(data.x ?? 0.5), 0, 1),
              y: clamp(Number(data.y ?? 0.5), 0, 1),
              z: clamp(Number(data.z ?? 0), -2, 2),
              confidence: clamp(Number(data.confidence ?? 0), 0, 1),
              timestamp: Date.now(),
            };

            broadcast(payload);
            return;
          }

          if (messageType === "orb_parent_claim") {
            const clientId = sanitizeClientId(data.clientId);
            if (!clientId) {
              return;
            }

            socketClientIds.set(socket, clientId);

            if (!orbParentClientId || orbParentClientId === clientId) {
              orbParentClientId = clientId;
              send(socket, {
                type: "orb_parent_claim_result",
                ok: true,
                parentId: orbParentClientId,
                timestamp: Date.now(),
              });
              broadcastParentStatus();
              return;
            }

            send(socket, {
              type: "orb_parent_claim_result",
              ok: false,
              parentId: orbParentClientId,
              reason: "already_claimed",
              timestamp: Date.now(),
            });
            return;
          }

          if (messageType === "orb_parent_release") {
            const clientId =
              sanitizeClientId(data.clientId) || socketClientIds.get(socket);
            releaseParentIfOwned(clientId);
            return;
          }

          if (messageType === "orb_rotation") {
            const clientId =
              sanitizeClientId(data.clientId) || socketClientIds.get(socket);
            if (!clientId || orbParentClientId !== clientId) {
              return;
            }

            const yaw = clamp(Number(data.yaw ?? 0), -Math.PI * 4, Math.PI * 4);
            const xRotation = clamp(
              Number(data.xRotation ?? 0),
              -Math.PI * 2,
              Math.PI * 2,
            );

            if (!Number.isFinite(yaw) || !Number.isFinite(xRotation)) {
              return;
            }

            broadcast({
              type: "orb_rotation",
              sourceId: clientId,
              yaw,
              xRotation,
              timestamp: Date.now(),
            });
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      });

      socket.on("close", () => {
        const clientId = socketClientIds.get(socket);
        releaseParentIfOwned(clientId);
        sockets.delete(socket);
      });

      socket.on("error", () => {
        const clientId = socketClientIds.get(socket);
        releaseParentIfOwned(clientId);
        sockets.delete(socket);
      });
    });

    server.on("upgrade", (request, socket, head) => {
      const requestUrl = request.url || "";
      const pathname = requestUrl.split("?")[0];

      if (pathname !== "/ws/subject") {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });

    server.listen(port, hostname, () => {
      const mode = dev ? "development" : "production";
      console.log(`> Ready on http://${hostname}:${port} (${mode})`);
      console.log(`> WebSocket relay available at ws://${hostname}:${port}/ws/subject`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
