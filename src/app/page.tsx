"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="fixed left-0 top-0 flex h-screen w-screen flex-col items-center justify-center">
      <h3 className="h3 hover:text-red-400">Streets</h3>

      <div className="w-fit rounded-lg bg-gray-200 p-4">
        <Link href="/hong-kong">
          <h3 className="h3 hover:text-red-400">Hong Kong</h3>
        </Link>
        <Link href="/jakarta">
          <h3 className="h3 hover:text-red-400">Jakarta</h3>
        </Link>
      </div>
    </main>
  );
}
