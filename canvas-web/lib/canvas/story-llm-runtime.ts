import type { CanvasFlowNode } from "./types";
import { isStoryLlmNodeType } from "./types";

export function storyLlmTextOutput(node: CanvasFlowNode): string {
  return (
    (node.data as { runtime?: { textOutput?: string } })?.runtime?.textOutput ??
    ""
  ).trim();
}

/** Story LLM：仅当有 Markdown 输出时才视为真正完成，可跳过。 */
export function storyLlmNodeIsComplete(node: CanvasFlowNode): boolean {
  if (!isStoryLlmNodeType(node.type ?? "")) return false;
  const st = (node.data as { runtime?: { status?: string } }).runtime?.status;
  return st === "done" && storyLlmTextOutput(node).length > 0;
}

export function storyLlmNodeNeedsRun(
  node: CanvasFlowNode,
  forceFresh?: boolean,
): boolean {
  if (forceFresh) return true;
  if (!isStoryLlmNodeType(node.type ?? "")) {
    return (node.data as { runtime?: { status?: string } }).runtime?.status !== "done";
  }
  return !storyLlmNodeIsComplete(node);
}
