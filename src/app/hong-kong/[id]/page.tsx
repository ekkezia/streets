import ModelCanvas from "@/components/molecules/model-canvas";
import { CONFIG } from "@/config/config";

export async function generateStaticParams() {
  const paths = [...Array(CONFIG["hong-kong"].numberOfImages)].map(
    (_, idx) => ({
      id: (idx + 1).toString(),
    }),
  );

  return paths;
}

export default async function Page({ params }: { params: { id: string } }) {
  return (
    <main className="fixed left-0 top-0 flex h-screen w-screen items-start justify-center">
      <ModelCanvas
        projectId="hong-kong"
        imageId={params.id}
        className="h-1/2 w-screen items-start justify-center sm:h-screen sm:w-1/2"
      />
      <ModelCanvas
        projectId="hong-kong"
        imageId={params.id}
        className="h-1/2 w-screen items-start justify-center sm:h-screen sm:w-1/2"
        doubleBy={44}
      />
    </main>
  );
}
