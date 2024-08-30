import ModelCanvas from "@/components/molecules/model-canvas";
import { CONFIG } from "@/config/config";

export async function getStaticPaths() {
  const paths = [...Array(CONFIG["jkt"].numberOfImages)].map(
    (_, idx) => ({
      params: { id: (idx + 1).toString() },
    }),
  );

  return { paths, fallback: false };
}

export default async function Page({ params }: { params: { id: string } }) {
  return (
    <main className="fixed left-0 top-0 h-screen w-screen">
      <ModelCanvas projectId="jkt" imageId={params.id} />
    </main>
  );
}
