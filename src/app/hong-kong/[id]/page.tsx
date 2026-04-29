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

export default function Page({ params }: { params: { id: string } }) {
  return (
    <main className="fixed left-0 top-0 flex h-screen w-screen items-start justify-center">
      <ModelCanvas
        projectId="hong-kong"
        imageId={params.id}
        column="2"
        rotation={[0, -Math.PI / 2, -Math.PI/4]}
        filterStyle="brightness(1.5) contrast(0.9)"
      />
      <ModelCanvas
        projectId="hong-kong"
        imageId={params.id}
        column="1"
        rotation={[0, -Math.PI / 2, -Math.PI/4]}
        filterStyle="brightness(1.5) contrast(0.9)"
        doubleBy={38}
      />
    </main>
  );
}
