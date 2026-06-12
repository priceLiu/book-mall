import type { CanvasGraph } from "./types";
import { canvasProjectEditionFromGraph, type CanvasProjectEdition } from "./project-edition-detect";

export type { CanvasProjectEdition };
export {
  canvasProjectEditionFromGraph,
  isStoryPro2PipelineNodeType,
  isStoryProPipelineNodeType,
} from "./project-edition-detect";

export const STORY_PRO_BUILTIN_TEMPLATE_ID = "builtin/story-pro-pipeline";
export const STORY_PRO2_BUILTIN_TEMPLATE_ID = "builtin/story-pro2-pipeline";
export const SBV1_BUILTIN_TEMPLATE_ID = "builtin/storyboard-video-pipeline";

export function isStoryProBuiltinTemplateId(id: string): boolean {
  return id === STORY_PRO_BUILTIN_TEMPLATE_ID;
}

export function isStoryPro2BuiltinTemplateId(id: string): boolean {
  return id === STORY_PRO2_BUILTIN_TEMPLATE_ID;
}

export function isSbv1BuiltinTemplateId(id: string): boolean {
  return id === SBV1_BUILTIN_TEMPLATE_ID;
}

export function canvasEditionFromTemplateCanvas(canvas: unknown): CanvasProjectEdition {
  return canvasProjectEditionFromGraph(canvas);
}

export function canvasEditionLabel(edition: CanvasProjectEdition): string {
  if (edition === "sbv1") return "分镜视频 1.0";
  if (edition === "pro2") return "影视专业版 2.0";
  if (edition === "pro") return "影视专业版";
  return "普通版";
}

export function canvasEditionBadgeClass(edition: CanvasProjectEdition): string {
  if (edition === "sbv1") {
    return "border-cyan-400/35 bg-cyan-500/15 text-cyan-100";
  }
  if (edition === "pro2") {
    return "border-fuchsia-400/35 bg-fuchsia-500/15 text-fuchsia-100";
  }
  if (edition === "pro") {
    return "border-violet-400/35 bg-violet-500/15 text-violet-200";
  }
  return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
}

/** 从已解析的画布 graph 推断版本（客户端模板筛选用） */
export function canvasEditionFromGraph(graph: CanvasGraph | unknown): CanvasProjectEdition {
  return canvasProjectEditionFromGraph(graph);
}
