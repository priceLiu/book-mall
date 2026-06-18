import type { Edge, Node } from "@xyflow/react";
import {
  portraitAssetRefFromNodeData,
  type CanvasPortraitNodeFields,
} from "./portrait-node-data";
import { directPredecessors } from "./topo";

const PORTRAIT_IMAGE_NODE_TYPES = new Set(["sbv1-image", "story-pro2-image"]);

export type PortraitAssetRefPayload = {
  url: string;
  role: "reference_image" | "first_frame" | "last_frame";
};

function uniqueDirectPredecessors(edges: Edge[], nodeId: string): string[] {
  return [...new Set(directPredecessors(edges, nodeId))];
}

export function dedupePortraitAssetRefs(
  refs: PortraitAssetRefPayload[],
): PortraitAssetRefPayload[] {
  const seen = new Set<string>();
  const out: PortraitAssetRefPayload[] = [];
  for (const ref of refs) {
    const url = ref.url.trim();
    if (!url.startsWith("asset://") || seen.has(url)) continue;
    seen.add(url);
    out.push({ ...ref, url });
  }
  return out;
}

/** 已入库人像对应的原 OSS URL（生视频时须改走 asset://，不可再传 HTTPS 人脸图） */
export function ossUrlsReplacedByPortraitUpstream(
  nodes: Node[],
  edges: Edge[],
  engineNodeId: string,
): Set<string> {
  const out = new Set<string>();
  for (const pid of uniqueDirectPredecessors(edges, engineNodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p?.type || !PORTRAIT_IMAGE_NODE_TYPES.has(p.type)) continue;
    if (!portraitAssetRefFromNodeData(p.data as CanvasPortraitNodeFields)) {
      continue;
    }
    const oss = String(
      (p.data as { ossUrl?: string }).ossUrl ?? "",
    ).trim();
    if (oss.startsWith("https://")) out.add(oss);
  }
  return out;
}

/**
 * 生视频前 reconciling：
 * - 去重 asset://（多条边连同一图片节点时）
 * - 已入库人像不再以 HTTPS OSS 提交（避免火山「含真人」400）
 */
export function reconcileVideoPortraitInputs(
  nodes: Node[],
  edges: Edge[],
  engineNodeId: string,
  imageInputs: string[],
  portraitAssetRefs: PortraitAssetRefPayload[],
): { imageInputs: string[]; portraitAssetRefs: PortraitAssetRefPayload[] } {
  const replacedOss = ossUrlsReplacedByPortraitUpstream(
    nodes,
    edges,
    engineNodeId,
  );
  const filteredImages = imageInputs.filter((u) => {
    const t = u.trim();
    return t && !replacedOss.has(t);
  });
  return {
    imageInputs: filteredImages,
    portraitAssetRefs: dedupePortraitAssetRefs(portraitAssetRefs),
  };
}

/** 从直连上游 LibTV 图片节点收集已入库的 asset:// 引用 */
export function resolvePortraitAssetRefsFromUpstream(
  nodes: Node[],
  edges: Edge[],
  nodeId: string,
): PortraitAssetRefPayload[] {
  const out: PortraitAssetRefPayload[] = [];
  for (const pid of uniqueDirectPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p?.type || !PORTRAIT_IMAGE_NODE_TYPES.has(p.type)) continue;
    const ref = portraitAssetRefFromNodeData(
      p.data as CanvasPortraitNodeFields,
    );
    if (ref) out.push(ref);
  }
  return dedupePortraitAssetRefs(out);
}

/** 从画布节点列表按 id 收集 portrait asset（Pro2 列视频等） */
export function portraitAssetRefsFromNodeIds(
  nodes: Node[],
  nodeIds: string[],
): PortraitAssetRefPayload[] {
  const out: PortraitAssetRefPayload[] = [];
  for (const nid of nodeIds) {
    const n = nodes.find((x) => x.id === nid);
    if (!n) continue;
    const ref = portraitAssetRefFromNodeData(
      n.data as CanvasPortraitNodeFields,
    );
    if (ref) out.push(ref);
  }
  return out;
}
