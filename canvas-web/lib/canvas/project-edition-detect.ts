/** 与 book-mall/lib/canvas/canvas-story-edition.ts 保持同步 */

export type CanvasProjectEdition = "pro" | "standard";

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

export function isStoryProPipelineNodeType(type: string): boolean {
  return STORY_PRO_NODE_TYPES.has(type);
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
    if (typeof type === "string" && isStoryProPipelineNodeType(type)) {
      return "pro";
    }
  }
  return "standard";
}
