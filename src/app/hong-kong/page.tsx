import ModelCanvas from "@/components/molecules/model-canvas";
import Phone from "@/components/molecules/phone";
import { CarousellContextProvider } from "@/contexts/carousell-context";

export default function Home() {
  return (
    <CarousellContextProvider>
      <main className="fixed left-0 top-0 flex h-screen w-screen items-start justify-center">
        <ModelCanvas
          projectId="hong-kong"
          imageId={"1"}
          className="h-[50vh] w-screen items-start justify-center sm:h-screen sm:w-1/2"
          column={"1"}
        />
        <ModelCanvas
          projectId="hong-kong"
          imageId={"1"}
          className="canvas h-[50vh] w-screen items-start justify-center sm:h-screen sm:w-1/2"
          doubleBy={38}
          column={"2"}
        />
      </main>
    </CarousellContextProvider>
  );
}
