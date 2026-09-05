import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { pro2StarterHasUpstreamLlmImage } from "./pro2-starter-dock-send";

/** 提示词节点 · 可发送：本地有文案，或上游有可传给 LLM 的参考图/视频 */
export function pro2PromptCanSend(input: {
  prompt: string;
  nodeId: string;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
}): boolean {
  if (input.prompt.trim()) return true;
  return pro2StarterHasUpstreamLlmImage(
    input.nodeId,
    input.nodes,
    input.edges,
  );
}
