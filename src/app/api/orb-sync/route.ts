import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BROADCASTER_STALE_MS = 8000;
const CAMERA_YAW_RANGE = Math.PI * 1.1;
const CAMERA_TILT_RANGE = Math.PI * 0.75;

type OrbRotationState = {
  yaw: number;
  xRotation: number;
  updatedAt: number;
};

type OrbSyncState = {
  broadcasterId: string | null;
  broadcasterLastSeen: number;
  rotation: OrbRotationState | null;
};

type OrbSyncSnapshot = {
  ok: boolean;
  broadcasterId: string | null;
  hasBroadcaster: boolean;
  rotation: OrbRotationState | null;
  timestamp: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __streetsOrbSyncState: OrbSyncState | undefined;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const sanitizeClientId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }

  return trimmed.slice(0, 64);
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const getState = (): OrbSyncState => {
  if (!global.__streetsOrbSyncState) {
    global.__streetsOrbSyncState = {
      broadcasterId: null,
      broadcasterLastSeen: 0,
      rotation: null,
    };
  }

  return global.__streetsOrbSyncState;
};

const maybeReleaseStaleBroadcaster = (state: OrbSyncState) => {
  if (!state.broadcasterId) {
    return;
  }

  if (Date.now() - state.broadcasterLastSeen <= BROADCASTER_STALE_MS) {
    return;
  }

  state.broadcasterId = null;
};

const createSnapshot = (
  state: OrbSyncState,
  ok = true,
): OrbSyncSnapshot => ({
  ok,
  broadcasterId: state.broadcasterId,
  hasBroadcaster: Boolean(state.broadcasterId),
  rotation: state.rotation,
  timestamp: Date.now(),
});

export async function GET() {
  const state = getState();
  maybeReleaseStaleBroadcaster(state);

  return NextResponse.json(createSnapshot(state), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function POST(request: Request) {
  const state = getState();
  maybeReleaseStaleBroadcaster(state);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const data = (body ?? {}) as Record<string, unknown>;
  const action = typeof data.action === "string" ? data.action : "";
  const clientId = sanitizeClientId(data.clientId);

  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: "missing_client_id" },
      { status: 400 },
    );
  }

  if (action === "claim") {
    if (!state.broadcasterId || state.broadcasterId === clientId) {
      state.broadcasterId = clientId;
      state.broadcasterLastSeen = Date.now();
      return NextResponse.json(createSnapshot(state, true), {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    return NextResponse.json(createSnapshot(state, false), {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  if (action === "heartbeat") {
    if (state.broadcasterId === clientId) {
      state.broadcasterLastSeen = Date.now();
      return NextResponse.json(createSnapshot(state, true), {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    return NextResponse.json(createSnapshot(state, false), {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  if (action === "release") {
    if (state.broadcasterId === clientId) {
      state.broadcasterId = null;
    }

    return NextResponse.json(createSnapshot(state, true), {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  if (action === "camera") {
    if (state.broadcasterId !== clientId) {
      return NextResponse.json(createSnapshot(state, false), {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    const x = toNumber(data.x);
    const y = toNumber(data.y);
    const confidenceValue = toNumber(data.confidence);

    if (x === null || y === null) {
      return NextResponse.json(
        { ok: false, error: "invalid_camera_payload" },
        { status: 400 },
      );
    }

    const normalizedX = clamp(x, 0, 1) - 0.5;
    const normalizedY = 0.5 - clamp(y, 0, 1);
    const strength = clamp(confidenceValue ?? 1, 0, 1);

    state.rotation = {
      yaw: normalizedX * CAMERA_YAW_RANGE * strength,
      xRotation: normalizedY * CAMERA_TILT_RANGE * strength,
      updatedAt: Date.now(),
    };
    state.broadcasterLastSeen = Date.now();

    return NextResponse.json(createSnapshot(state, true), {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  return NextResponse.json(
    { ok: false, error: "unsupported_action" },
    { status: 400 },
  );
}
