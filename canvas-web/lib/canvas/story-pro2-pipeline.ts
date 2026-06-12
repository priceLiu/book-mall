import type { CanvasFlowNode } from "./types";

/** 影视专业版 2.0 全链路节点（与 comic / pro 互斥） */
export const STORY_PRO2_NODE_TYPES = [
  "story-pro2-starter",
  "story-pro2-script-hub",
  "story-pro2-style",
  "story-pro2-style-asset",
  "story-pro2-image",
  "story-pro2-three-view",
  "story-pro2-character",
  "story-pro2-scene",
  "story-pro2-frame",
  "story-pro2-video",
  "jianying-export-pro2",
] as const;

export type StoryPro2NodeType = (typeof STORY_PRO2_NODE_TYPES)[number];

const STORY_PRO2_NODE_TYPE_SET = new Set<string>(STORY_PRO2_NODE_TYPES);

export function isStoryPro2PipelineNode(type: string): boolean {
  return STORY_PRO2_NODE_TYPE_SET.has(type);
}

export function hasStoryPro2Pipeline(nodes: CanvasFlowNode[]): boolean {
  return nodes.some((n) => isStoryPro2PipelineNode(n.type ?? ""));
}
