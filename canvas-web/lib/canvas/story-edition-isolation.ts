import type { CanvasFlowNode } from "./types";
import { isStoryProPipelineNode } from "./types";
import { hasStoryComicPipeline } from "./story-comic-layout";
import { hasStoryProPipeline } from "./story-pro-workspace-layout";
import {
  hasStoryPro2Pipeline,
  isStoryPro2PipelineNode,
} from "./story-pro2-pipeline";
import { hasSbv1Pipeline, isSbv1PipelineNodeType } from "./sbv1-pipeline";

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

export type StoryCanvasEdition = "pro" | "pro2" | "sbv1" | "comic" | "neutral";

export function storyEditionForNodeType(type: string): StoryCanvasEdition {
  if (isSbv1PipelineNodeType(type)) return "sbv1";
  if (isStoryPro2PipelineNode(type)) return "pro2";
  if (isStoryProPipelineNode(type)) return "pro";
  if (isStoryComicPipelineNode(type)) return "comic";
  return "neutral";
}

export function canvasStoryEdition(
  nodes: CanvasFlowNode[],
): StoryCanvasEdition {
  if (hasSbv1Pipeline(nodes)) return "sbv1";
  if (hasStoryPro2Pipeline(nodes)) return "pro2";
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

  if (nodeEdition !== canvasEdition) {
    const labels: Record<StoryCanvasEdition, string> = {
      comic: "故事创作 / 快手漫剧",
      pro: "影视专业版 1.0",
      pro2: "影视专业版 2.0",
      sbv1: "分镜视频 1.0",
      neutral: "通用",
    };
    return {
      ok: false,
      message: `当前画布为「${labels[canvasEdition]}」工作流，不能添加「${labels[nodeEdition]}」节点。请新建对应版本画布或载入匹配模板。`,
    };
  }
  return { ok: true };
}

export function isMixedStoryEditionCanvas(nodes: CanvasFlowNode[]): boolean {
  const editions = new Set<StoryCanvasEdition>();
  for (const n of nodes) {
    const e = storyEditionForNodeType(n.type ?? "");
    if (e !== "neutral") editions.add(e);
  }
  return editions.size > 1;
}
