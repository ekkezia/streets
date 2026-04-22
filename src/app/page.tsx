"use client";

import Link from "next/link";
import { useState } from "react";
import useRestrictedUiAccess from "@/hooks/useRestrictedUiAccess";

export default function Home() {
  const isRestrictedUiAllowed = useRestrictedUiAccess();
  const [viewMode, setViewMode] = useState<
    "sphere" | "orb" | "orb3d" | "equirect"
  >("sphere");

  const getLocationHref = (path: string) => {
    if (!isRestrictedUiAllowed) {
      return path;
    }

    if (viewMode === "orb") {
      return `${path}?view=orb`;
    }
    if (viewMode === "orb3d") {
      return `${path}?view=orb3d`;
    }
    if (viewMode === "equirect") {
      return `${path}?view=equirect`;
    }
    return path;
  };

  const modeDescription =
    viewMode === "orb"
      ? "Location links open the rotating 3D glass orb view"
      : viewMode === "orb3d"
        ? "Location links open 4-way hologram orb layout in a diamond pattern"
      : viewMode === "equirect"
        ? "Location links open raw equirectangular images on black background"
        : "Standard 360 sphere view";

  return (
    <main className="fixed left-0 top-0 flex h-screen w-screen flex-col justify-center">
      <div className="flex items-center gap-3 px-4 pt-4">
        {isRestrictedUiAllowed && (
          <>
            <button
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                viewMode === "sphere"
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-700"
              }`}
              onClick={() => setViewMode("sphere")}
              type="button"
            >
              Sphere Mode
            </button>
            <button
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                viewMode === "orb"
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-700"
              }`}
              onClick={() => setViewMode("orb")}
              type="button"
            >
              Glass Orb Mode
            </button>
            <button
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                viewMode === "equirect"
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-700"
              }`}
              onClick={() => setViewMode("equirect")}
              type="button"
            >
              Equirectangular Mode
            </button>
            <button
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                viewMode === "orb3d"
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-700"
              }`}
              onClick={() => setViewMode("orb3d")}
              type="button"
            >
              Orb 3D Mode
            </button>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              {modeDescription}
            </p>
          </>
        )}
      </div>

      <div className="no-scrollbar flex w-full gap-8 overflow-x-scroll rounded-none bg-gray-200 px-4 py-12">
        <Link href={getLocationHref("/hong-kong")}>
          <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white hover:text-gray-300">
            Hong Kong
          </h3>
        </Link>
        <Link href={getLocationHref("/jakarta")}>
          <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white hover:text-gray-300">
            Jakarta
          </h3>
        </Link>
        <Link href={getLocationHref("/singapore")}>
          <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white hover:text-gray-300">
            Singapore
          </h3>
        </Link>
        <Link href={getLocationHref("/cambodia")}>
          <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white hover:text-gray-300">
            Cambodia
          </h3>
        </Link>
        <Link href={getLocationHref("/new-york-city")}>
          <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white hover:text-gray-300">
            New York City
          </h3>
        </Link>

        <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white"></h3>
        <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white"></h3>
        <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white"></h3>
        <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white"></h3>
        <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white"></h3>
        <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white"></h3>
        <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white"></h3>
        <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white"></h3>
        <h3 className="h3 min-w-[100px] rounded-sm bg-gray-500 px-2 text-center text-nowrap text-white"></h3>
      </div>

      <h1 className="p-4 text-6xl font-bold text-gray-400">Streets</h1>
      <p className="max-w-[560px] p-4 text-sm font-bold text-gray-600">
        A collection of choose-your-adventure stories in the form of 360 degree
        images, inspired by Google Streets View.
      </p>
    </main>
  );
}
