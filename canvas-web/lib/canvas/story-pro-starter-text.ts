import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import type { StoryProStarterNodeData } from "./story-pro-workspace-types";
import {
  formatUploadedScriptForLlm,
} from "./story-pro-upload-script";

function directPredecessors(
  edges: CanvasFlowEdge[],
  nodeId: string,
  targetHandle?: string,
): string[] {
  return edges
    .filter(
      (e) =>
        e.target === nodeId &&
        (!targetHandle || e.targetHandle === targetHandle),
    )
    .map((e) => e.source);
}

/** 从单个节点提取可下游传递的文本（piped text / LLM output / 手动文本） */
export function resolveNodeTextPayload(
  nodes: CanvasFlowNode[],
  nodeId: string,
): string | null {
  const n = nodes.find((x) => x.id === nodeId);
  if (!n) return null;
  if (n.type === "text") {
    const d = n.data as { mode?: string; text?: string; runtime?: { textOutput?: string } };
    if (d.mode === "piped" && d.runtime?.textOutput?.trim()) {
      return d.runtime.textOutput.trim();
    }
    if (d.text?.trim()) return d.text.trim();
  }
  if (
    n.type === "ai-engine" ||
    n.type === "story-outline-engine" ||
    n.type === "character-engine" ||
    n.type === "storyboard-engine"
  ) {
    const out = (n.data as { runtime?: { textOutput?: string } }).runtime
      ?.textOutput;
    if (out?.trim()) return out.trim();
  }
  return null;
}

/** 影视专业启动节点 → 供故事剧本 hub 使用的剧本文本 */
export function resolveStoryProStarterScriptInput(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  starterId: string,
): string | null {
  const starter = nodes.find((n) => n.id === starterId);
  if (!starter || starter.type !== "story-pro-starter") return null;
  const d = starter.data as unknown as StoryProStarterNodeData;

  for (const upId of directPredecessors(edges, starterId, "in_text")) {
    const upstream = resolveNodeTextPayload(nodes, upId);
    if (upstream) {
      return `# 上游剧本\n\n${upstream}`;
    }
  }

  if (d.uploadedScriptMd?.trim()) {
    return formatUploadedScriptForLlm({
      md: d.uploadedScriptMd,
      meta: d.uploadedScriptMeta,
    });
  }

  if (d.starterMode === "generate" && d.systemPrompt?.trim()) {
    return d.systemPrompt.trim();
  }

  return null;
}
