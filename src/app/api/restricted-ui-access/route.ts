import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const parseBooleanEnv = (value: string | undefined): boolean | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return null;
};

export async function GET() {
  const envValue = parseBooleanEnv(process.env.REACT_APP_SHOW_MODE);
  const isAllowed =
    envValue !== null ? envValue : process.env.NODE_ENV !== "production";

  return NextResponse.json(
    { isAllowed },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
