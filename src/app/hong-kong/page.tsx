import ModelCanvas from "@/components/molecules/model-canvas";

export default function Home() {
  return (
    <main className="fixed left-0 top-0 flex h-screen w-screen items-start justify-center">
      <ModelCanvas
        projectId="hkg"
        imageId={"1"}
        className="h-1/2 w-screen items-start justify-center sm:h-screen sm:w-1/2"
      />
      <ModelCanvas
        projectId="hkg"
        imageId={"1"}
        className="h-1/2 w-screen items-start justify-center sm:h-screen sm:w-1/2"
        doubleBy={44}
      />
    </main>
  );
}
