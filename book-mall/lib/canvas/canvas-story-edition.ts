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
  "story-pro2-prop",
  "story-pro2-mood",
  "story-pro2-audio",
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

type CanvasGraphMetaHint = {
  edition?: string;
  crewBulletinAnchor?: unknown;
  linkedScriptPackageAssetId?: string;
};

function readCanvasGraphMetaHint(meta: unknown): CanvasGraphMetaHint | null {
  if (!meta || typeof meta !== "object") return null;
  return meta as CanvasGraphMetaHint;
}

/** 列表轻量查询：仅 meta，不扫全量 nodes */
export function canvasProjectEditionFromMeta(meta: unknown): CanvasProjectEdition {
  const m = readCanvasGraphMetaHint(meta);
  if (!m) return "standard";
  if (m.edition === "sbv1") return "sbv1";
  if (m.edition === "pro2") return "pro2";
  if (m.crewBulletinAnchor || m.linkedScriptPackageAssetId) return "pro2";
  return "standard";
}

export function canvasProjectEditionFromNodeTypes(
  nodeTypes: Iterable<string> | null | undefined,
): CanvasProjectEdition {
  if (!nodeTypes) return "standard";
  for (const type of nodeTypes) {
    if (typeof type !== "string") continue;
    if (isSbv1PipelineNodeType(type)) return "sbv1";
    if (isStoryPro2PipelineNodeType(type)) return "pro2";
    if (isStoryProPipelineNodeType(type)) return "pro";
  }
  return "standard";
}

/** 列表轻量查询：meta + 节点 type 数组（SQL jsonb_agg），避免加载整张 canvas */
export function canvasProjectEditionFromListHints(
  meta: unknown,
  nodeTypes: Iterable<string> | null | undefined,
): CanvasProjectEdition {
  const fromMeta = canvasProjectEditionFromMeta(meta);
  if (fromMeta !== "standard") return fromMeta;
  return canvasProjectEditionFromNodeTypes(nodeTypes);
}

/** 已绑定脚本包 / 公告栏的协同画布，禁止删除 */
export function canvasProjectHasCollaboration(meta: unknown): boolean {
  const m = readCanvasGraphMetaHint(meta);
  if (!m) return false;
  if (m.crewBulletinAnchor) return true;
  return Boolean(m.linkedScriptPackageAssetId?.trim());
}

export function canvasProjectHasCollaborationFromGraph(
  canvas: unknown,
): boolean {
  if (!canvas || typeof canvas !== "object") return false;
  const meta = (canvas as { meta?: unknown }).meta;
  return canvasProjectHasCollaboration(meta);
}

export function canvasProjectEditionFromGraph(
  canvas: unknown,
): CanvasProjectEdition {
  if (!canvas || typeof canvas !== "object") return "standard";

  const meta = (canvas as { meta?: CanvasGraphMetaHint }).meta;
  const fromMeta = canvasProjectEditionFromMeta(meta);
  if (fromMeta !== "standard") return fromMeta;

  const nodes = (canvas as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return "standard";
  const types: string[] = [];
  for (const raw of nodes) {
    if (!raw || typeof raw !== "object") continue;
    const type = (raw as { type?: unknown }).type;
    if (typeof type === "string") types.push(type);
  }
  return canvasProjectEditionFromNodeTypes(types);
}
