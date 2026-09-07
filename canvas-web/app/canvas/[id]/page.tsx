import dynamic from "next/dynamic";

import { CanvasEditorRouteLoading } from "@/components/canvas/canvas-editor-loading";

const CanvasPageClient = dynamic(
  () =>
    import("./canvas-page-client").then((m) => ({
      default: m.CanvasPageClient,
    })),
  {
    loading: () => (
      <CanvasEditorRouteLoading label="正在打开编辑器…" />
    ),
  },
);

export const metadata = { title: "画布编辑器 · canvas-web" };

type Ctx = { params: Promise<{ id: string }> };

export default async function CanvasEditorPage({ params }: Ctx) {
  const { id } = await params;
  return <CanvasPageClient projectId={id} />;
}
