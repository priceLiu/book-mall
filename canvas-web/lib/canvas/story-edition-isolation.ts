import type { CanvasFlowNode } from "./types";
import { isStoryProPipelineNode } from "./types";
import { hasStoryComicPipeline } from "./story-comic-layout";
import { hasStoryProPipeline } from "./story-pro-workspace-layout";

/** 快手漫剧全链路节点（与影视专业版互斥） */
export function isStoryComicPipelineNode(t: string): boolean {
  return (
    t === "story-comic-starter" ||
    t === "story-script-hub" ||
    t === "story-character-column" ||
    t === "story-frame-column" ||
    t === "story-video-column" ||
    t === "story-outline-engine" ||
    t === "character-engine" ||
    t === "storyboard-engine" ||
    t === "jianying-export"
  );
}

export type StoryCanvasEdition = "pro" | "comic" | "neutral";

export function storyEditionForNodeType(type: string): StoryCanvasEdition {
  if (isStoryProPipelineNode(type)) return "pro";
  if (isStoryComicPipelineNode(type)) return "comic";
  return "neutral";
}

export function canvasStoryEdition(
  nodes: CanvasFlowNode[],
): StoryCanvasEdition {
  if (hasStoryProPipeline(nodes)) return "pro";
  if (hasStoryComicPipeline(nodes)) return "comic";
  return "neutral";
}

export function canAddStoryNodeType(
  type: string,
  nodes: CanvasFlowNode[],
): { ok: true } | { ok: false; message: string } {
  const nodeEdition = storyEditionForNodeType(type);
  if (nodeEdition === "neutral") return { ok: true };

  const canvasEdition = canvasStoryEdition(nodes);
  if (canvasEdition === "neutral") return { ok: true };

  if (nodeEdition === "pro" && canvasEdition === "comic") {
    return {
      ok: false,
      message:
        "当前画布为「故事创作 / 快手漫剧」工作流，不能添加影视专业版节点。请新建画布或载入影视专业版模板。",
    };
  }
  if (nodeEdition === "comic" && canvasEdition === "pro") {
    return {
      ok: false,
      message:
        "当前画布为「影视专业版」工作流，不能添加快手漫剧节点。项目资产可在工具栏共用，但节点类型须隔离。",
    };
  }
  return { ok: true };
}

export function isMixedStoryEditionCanvas(nodes: CanvasFlowNode[]): boolean {
  return hasStoryProPipeline(nodes) && hasStoryComicPipeline(nodes);
}
