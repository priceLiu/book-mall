import type { CanvasGraph } from "./types";
import { canvasProjectEditionFromGraph, type CanvasProjectEdition } from "./project-edition-detect";

export type { CanvasProjectEdition };
export { canvasProjectEditionFromGraph, isStoryProPipelineNodeType } from "./project-edition-detect";

export const STORY_PRO_BUILTIN_TEMPLATE_ID = "builtin/story-pro-pipeline";

export function isStoryProBuiltinTemplateId(id: string): boolean {
  return id === STORY_PRO_BUILTIN_TEMPLATE_ID;
}

export function canvasEditionFromTemplateCanvas(canvas: unknown): CanvasProjectEdition {
  return canvasProjectEditionFromGraph(canvas);
}

export function canvasEditionLabel(edition: CanvasProjectEdition): string {
  return edition === "pro" ? "影视专业版" : "普通版";
}

export function canvasEditionBadgeClass(edition: CanvasProjectEdition): string {
  return edition === "pro"
    ? "border-violet-400/35 bg-violet-500/15 text-violet-200"
    : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
}

/** 从已解析的画布 graph 推断版本（客户端模板筛选用） */
export function canvasEditionFromGraph(graph: CanvasGraph | unknown): CanvasProjectEdition {
  return canvasProjectEditionFromGraph(graph);
}
