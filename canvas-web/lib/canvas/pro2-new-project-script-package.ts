import { buildCrewBulletinGraphAnchorFromAsset } from "./crew-bulletin-graph-anchor";
import type { CanvasGraph } from "./types";

export type NewProjectScriptPackageAsset = {
  id: string;
  displayName: string;
  payload: Record<string, unknown>;
};

/** 新建 Pro2 · 关联已发布剧本 → 空白画布 + graph.meta 公告栏锚点 */
export function applyScriptPackageToNewPro2Graph(
  graph: CanvasGraph,
  asset: NewProjectScriptPackageAsset,
): CanvasGraph {
  const anchor = buildCrewBulletinGraphAnchorFromAsset(asset);
  return {
    ...graph,
    nodes: [],
    edges: [],
    meta: {
      ...graph.meta,
      edition: "pro2",
      linkedScriptPackageAssetId: asset.id,
      crewBulletinAnchor: anchor,
    },
  };
};
