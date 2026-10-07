import { createCanvasProject } from "@/lib/canvas-api";
import { ensureGraphMetaEdition } from "@/lib/canvas/canvas-layout-mode";
import { cloneGraphForNewProject } from "@/lib/canvas/clone";
import { defaultCanvasProjectName } from "@/lib/canvas/default-project-name";
import { withPro2ScriptFormatV13Meta } from "@/lib/canvas/pro2-project-format";
import { markCanvasProjectDiscardIfStillEmpty } from "@/lib/canvas/canvas-discard-empty-new-session";
import { BLANK_CANVAS } from "@/lib/canvas/templates";

/** 新建空白影视专业版 2.0 画布（首页「开始我的创作」） */
export async function createPro2BlankCanvasProject(
  base: string,
  name?: string,
): Promise<{ id: string }> {
  let graph = cloneGraphForNewProject(BLANK_CANVAS);
  graph = withPro2ScriptFormatV13Meta(graph);
  graph = {
    ...graph,
    meta:
      ensureGraphMetaEdition(graph.nodes ?? [], graph.meta ?? null) ??
      graph.meta,
  };
  const created = await createCanvasProject(base, {
    name: name?.trim() || defaultCanvasProjectName(),
    canvas: graph,
  });
  markCanvasProjectDiscardIfStillEmpty(created.id);
  return { id: created.id };
}
