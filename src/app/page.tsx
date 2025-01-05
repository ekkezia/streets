"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="fixed left-0 top-0 flex h-screen w-screen flex-col justify-center">
      <h1 className="text-2xl p-4">Streets</h1>

      <div className="w-full rounded-lg bg-gray-200 px-4 py-12 flex gap-8 overflow-x-scroll">
        <Link href="/hong-kong">
          <h3 className="h3 hover:text-gray-300 bg-gray-500 rounded-sm px-2 text-white min-w-[100px] text-center text-nowrap">Hong Kong</h3>
        </Link>
        <Link href="/jakarta">
          <h3 className="h3 hover:text-gray-300 bg-gray-500 rounded-sm px-2 text-white min-w-[100px] text-center text-nowrap">Jakarta</h3>
        </Link>
                <Link href="/singapore">
          <h3 className="h3 hover:text-gray-300 bg-gray-500 rounded-sm px-2 text-white min-w-[100px] text-center text-nowrap">Singapore</h3>
        </Link>
                <Link href="/cambodia">
          <h3 className="h3 hover:text-gray-300 bg-gray-500 rounded-sm px-2 text-white min-w-[100px] text-center text-nowrap">Cambodia</h3>
        </Link>


          <h3 className="h3 hover:text-gray-300 bg-gray-500 rounded-sm px-2 text-white min-w-[100px] text-center text-nowrap"></h3>
          <h3 className="h3 hover:text-gray-300 bg-gray-500 rounded-sm px-2 text-white min-w-[100px] text-center text-nowrap"></h3>
          <h3 className="h3 hover:text-gray-300 bg-gray-500 rounded-sm px-2 text-white min-w-[100px] text-center text-nowrap"></h3>
          <h3 className="h3 hover:text-gray-300 bg-gray-500 rounded-sm px-2 text-white min-w-[100px] text-center text-nowrap"></h3>
          <h3 className="h3 hover:text-gray-300 bg-gray-500 rounded-sm px-2 text-white min-w-[100px] text-center text-nowrap"></h3>
          <h3 className="h3 hover:text-gray-300 bg-gray-500 rounded-sm px-2 text-white min-w-[100px] text-center text-nowrap"></h3>
          <h3 className="h3 hover:text-gray-300 bg-gray-500 rounded-sm px-2 text-white min-w-[100px] text-center text-nowrap"></h3>
          <h3 className="h3 hover:text-gray-300 bg-gray-500 rounded-sm px-2 text-white min-w-[100px] text-center text-nowrap"></h3>
          <h3 className="h3 hover:text-gray-300 bg-gray-500 rounded-sm px-2 text-white min-w-[100px] text-center text-nowrap"></h3>

      </div>
    </main>
  );
}
