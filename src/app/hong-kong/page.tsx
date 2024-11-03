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
          className="h-1/2 w-screen items-start justify-center sm:h-screen sm:w-1/2"
        />
        <ModelCanvas
          projectId="hong-kong"
          imageId={"1"}
          className="h-1/2 w-screen items-start justify-center sm:h-screen sm:w-1/2"
          doubleBy={44}
        />
        <Phone />
      </main>
    </CarousellContextProvider>
  );
}
