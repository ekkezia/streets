import ModelCanvas from "@/components/molecules/model-canvas";

export default function Home() {
  return (
    <main className="fixed left-0 top-0 flex h-screen w-screen items-start justify-center">
      <ModelCanvas projectId="new-york-city" imageId={"1"} withSubtitle filterStyle="brightness(1.1) contrast(0.9)" />
    </main>
  );
}
