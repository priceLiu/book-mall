import { pickPersistableProjectThumbnailUrl } from "@/lib/canvas/project-thumbnail";
import { stripStoryProUploadedScriptMdForPersist } from "@/lib/canvas/story-pro-upload-script";
import { useCanvasStore } from "@/lib/canvas/store";

/** 点击「生成」时随 run 请求上传的画布快照（用于生成记录 · 恢复画布）。 */
export function buildCanvasRunSnapshot(): {
  canvas: ReturnType<ReturnType<typeof useCanvasStore.getState>["toGraph"]>;
  thumbnailUrl?: string;
} {
  const graph = stripStoryProUploadedScriptMdForPersist(
    useCanvasStore.getState().toGraph(),
  );
  const thumb = pickPersistableProjectThumbnailUrl(graph);
  return {
    canvas: graph,
    ...(thumb ? { thumbnailUrl: thumb } : {}),
  };
}
