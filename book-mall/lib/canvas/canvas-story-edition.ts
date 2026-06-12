/** 列表/筛选用：影视专业版 vs 分镜视频 1.0 vs 普通版 */

export type CanvasProjectEdition = "pro" | "pro2" | "sbv1" | "standard";

const STORY_PRO_NODE_TYPES = new Set([
  "story-pro-starter",
  "story-pro-script-hub",
  "story-pro-style",
  "story-pro-character",
  "story-pro-scene",
  "story-pro-frame",
  "story-pro-video",
  "jianying-export-pro",
]);

const STORY_PRO2_NODE_TYPES = new Set([
  "story-pro2-starter",
  "story-pro2-script-hub",
  "story-pro2-style",
  "story-pro2-character",
  "story-pro2-scene",
  "story-pro2-frame",
  "story-pro2-video",
  "jianying-export-pro2",
]);

const SBV1_NODE_TYPES = new Set(["sbv1-image", "sbv1-video-engine"]);

export function isStoryProPipelineNodeType(type: string): boolean {
  return STORY_PRO_NODE_TYPES.has(type);
}

export function isStoryPro2PipelineNodeType(type: string): boolean {
  return STORY_PRO2_NODE_TYPES.has(type);
}

export function isSbv1PipelineNodeType(type: string): boolean {
  return SBV1_NODE_TYPES.has(type);
}

/** story-pro2 节点 type → runner 分支用的 pro 等价 type */
export function storyPro2ToProRunnerType(type: string): string {
  if (type.startsWith("story-pro2-")) {
    return type.replace("story-pro2-", "story-pro-");
  }
  if (type === "jianying-export-pro2") return "jianying-export-pro";
  return type;
}

export function canvasProjectEditionFromGraph(
  canvas: unknown,
): CanvasProjectEdition {
  if (!canvas || typeof canvas !== "object") return "standard";
  const nodes = (canvas as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return "standard";
  for (const raw of nodes) {
    if (!raw || typeof raw !== "object") continue;
    const type = (raw as { type?: unknown }).type;
    if (typeof type !== "string") continue;
    if (isSbv1PipelineNodeType(type)) return "sbv1";
    if (isStoryPro2PipelineNodeType(type)) return "pro2";
    if (isStoryProPipelineNodeType(type)) return "pro";
  }
  return "standard";
}
