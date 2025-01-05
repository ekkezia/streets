import ModelCanvas from "@/components/molecules/model-canvas";

export default function Home() {
  return (
    <main className="fixed left-0 top-0 flex h-screen w-screen items-start justify-center">
      <ModelCanvas projectId="cambodia" imageId={"1"} withSubtitle scale={[1, 1, -1]} />
    </main>
  );
}
