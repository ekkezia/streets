import ModelCanvas from "@/components/molecules/model-canvas";
import { CONFIG } from "@/config/config";

export async function generateStaticParams() {
  const paths = [...Array(CONFIG["jakarta"].numberOfImages)].map((_, idx) => ({
    id: (idx + 1).toString(),
  }));

  return paths;
}

export default async function Page({ params }: { params: { id: string } }) {
  return (
    <main className="fixed left-0 top-0 flex h-screen w-screen items-start justify-center">
      <ModelCanvas projectId="singapore" imageId={params.id} withSubtitle />
    </main>
  );
}
