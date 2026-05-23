import { CanvasPageClient } from "./canvas-page-client";

export const metadata = { title: "画布编辑器 · canvas-web" };

type Ctx = { params: Promise<{ id: string }> };

export default async function CanvasEditorPage({ params }: Ctx) {
  const { id } = await params;
  return <CanvasPageClient projectId={id} />;
}
