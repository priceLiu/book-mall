import type { CanvasFlowNode } from "./types";
import { STORY_OUTLINE_LLM_PARAMS } from "./story-prompts";

const STORY_OUTLINE_LLM_NODE_TYPES = new Set([
  "story-comic-starter",
  "story-script-hub",
  "story-pro-starter",
  "story-pro-script-hub",
  "story-outline-engine",
]);

const OUTLINE_MAX_TOKENS = STORY_OUTLINE_LLM_PARAMS.max_tokens;

/** 加载画布时：故事大纲相关节点 max_tokens 低于当前默认则抬升（避免旧图 4000/8000 截断输出） */
export function migrateStoryOutlineLlmParams(n: CanvasFlowNode): CanvasFlowNode {
  if (!STORY_OUTLINE_LLM_NODE_TYPES.has(n.type ?? "")) return n;
  const data = { ...((n.data ?? {}) as Record<string, unknown>) };
  const rawParams = data.params;
  const params =
    rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)
      ? { ...(rawParams as Record<string, unknown>) }
      : {};
  const cur =
    typeof params.max_tokens === "number" && Number.isFinite(params.max_tokens)
      ? params.max_tokens
      : 0;
  if (cur >= OUTLINE_MAX_TOKENS) return n;
  params.max_tokens = OUTLINE_MAX_TOKENS;
  data.params = params;
  return { ...n, data };
}

export function migrateStoryOutlineLlmParamsAll(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return nodes.map(migrateStoryOutlineLlmParams);
}
