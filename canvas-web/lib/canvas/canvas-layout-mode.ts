import {
  hasLibtvMediaCanvasNodes,
  hasOnlySbv1LibtvCanvas,
} from "./libtv-canvas-detect";
import type { CanvasFlowNode } from "./types";
import { hasStoryPro2Pipeline } from "./story-pro2-pipeline";
import { hasSbv1Pipeline } from "./sbv1-pipeline";

/** 画布外壳：决定 FlowCanvas flags 与底部 Dock 套件 */
export type CanvasLayoutShell = "pro2" | "sbv1" | "legacy";

/** 根据 graph 推断 meta.edition（hydrate / 新建时补齐，避免落 legacy 外壳） */
export function ensureGraphMetaEdition(
  nodes: CanvasFlowNode[],
  meta?: {
    edition?: string;
    crewBulletinAnchor?: unknown;
    linkedScriptPackageAssetId?: string;
  } | null,
): typeof meta {
  const shell = resolveCanvasLayoutShell({
    projectEdition: meta?.edition,
    nodes,
    graphMeta: meta ?? null,
  });
  if (shell === "legacy") return meta ?? null;
  const edition = shell === "pro2" ? "pro2" : "sbv1";
  if (meta?.edition === edition) return meta ?? null;
  return { ...(meta ?? {}), edition };
}

/**
 * Pro2 项目可混用 sbv1 媒体节点（反推 / 文生视频预设），
 * 外壳须以 **项目 edition / Pro2 流水线** 为准，不能因单个 sbv1 节点切到 sbv1 布局。
 */
export function resolveCanvasLayoutShell(args: {
  projectEdition?: string | null;
  nodes: CanvasFlowNode[];
  graphMeta?: { edition?: string; crewBulletinAnchor?: unknown; linkedScriptPackageAssetId?: string } | null;
}): CanvasLayoutShell {
  const { projectEdition, nodes, graphMeta } = args;
  const metaEdition = graphMeta?.edition;
  const metaPro2Collaboration =
    Boolean(graphMeta?.crewBulletinAnchor) ||
    Boolean(graphMeta?.linkedScriptPackageAssetId);

  const explicitSbv1 =
    projectEdition === "sbv1" || metaEdition === "sbv1";
  const libtvMedia = hasLibtvMediaCanvasNodes(nodes);

  if (
    projectEdition === "pro2" ||
    metaEdition === "pro2" ||
    metaPro2Collaboration ||
    hasStoryPro2Pipeline(nodes) ||
    (libtvMedia && !explicitSbv1 && !hasOnlySbv1LibtvCanvas(nodes))
  ) {
    return "pro2";
  }
  if (explicitSbv1 || hasSbv1Pipeline(nodes) || hasOnlySbv1LibtvCanvas(nodes)) {
    return "sbv1";
  }
  if (libtvMedia) return "pro2";
  return "legacy";
}
