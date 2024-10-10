'use client'

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    router.push('/jakarta/1')
  }, [])

  return <main className="fixed left-0 top-0 h-screen w-screen"></main>;
}
