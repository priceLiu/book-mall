import { createCanvasProject } from "@/lib/canvas-api";
import { ensureGraphMetaEdition } from "@/lib/canvas/canvas-layout-mode";
import { cloneGraphForNewProject } from "@/lib/canvas/clone";
import { defaultCanvasProjectName } from "@/lib/canvas/default-project-name";
import { STORY_PRO2_BUILTIN_TEMPLATE_ID } from "@/lib/canvas/project-edition";
import { BLANK_CANVAS, BUILTIN_CANVAS_TEMPLATES } from "@/lib/canvas/templates";
import type { CanvasGraph } from "@/lib/canvas/types";

/** 新建空白影视专业版 2.0 画布（首页「开始我的创作」） */
export async function createPro2BlankCanvasProject(
  base: string,
  name?: string,
): Promise<{ id: string }> {
  const builtin = BUILTIN_CANVAS_TEMPLATES.find(
    (t) => t.id === STORY_PRO2_BUILTIN_TEMPLATE_ID,
  );
  let graph = cloneGraphForNewProject(
    (builtin?.canvas as CanvasGraph | undefined) ?? BLANK_CANVAS,
  );
  graph = {
    ...graph,
    meta: { ...(graph.meta ?? {}), edition: "pro2" },
  };
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
  return { id: created.id };
}
