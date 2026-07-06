/** 与 canvas-web/lib/canvas/project-edition-detect.ts 保持同步 */

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
  "story-pro2-style-asset",
  "story-pro2-image",
  "story-pro2-three-view",
  "story-pro2-character",
  "story-pro2-scene",
  "story-pro2-frame",
  "story-pro2-video",
  "story-pro2-prop",
  "story-pro2-mood",
  "story-pro2-audio",
  "jianying-export-pro2",
  "jianying-auto-render-pro2",
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

export function canvasProjectEditionFromGraph(
  canvas: unknown,
): CanvasProjectEdition {
  if (!canvas || typeof canvas !== "object") return "standard";

  const meta = (canvas as { meta?: { edition?: string; crewBulletinAnchor?: unknown; linkedScriptPackageAssetId?: string } }).meta;
  if (meta?.edition === "sbv1") return "sbv1";
  if (meta?.edition === "pro2") return "pro2";
  /** 空白协作画布 · 仅 meta 存公告栏锚点 */
  if (meta?.crewBulletinAnchor || meta?.linkedScriptPackageAssetId) {
    return "pro2";
  }

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
