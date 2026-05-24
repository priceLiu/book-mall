import { directPredecessors } from "./topo";
import type {
  CanvasFlowEdge,
  CanvasFlowNode,
  ImageEngineNodeData,
  ImageNodeData,
} from "./types";

/** 上游图片 URL（image / image-engine 输出），保持入边顺序、去重。 */
export function resolveUpstreamImageUrls(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  nodeId: string,
): string[] {
  const out: string[] = [];
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p) continue;
    if (p.type === "image") {
      const d = p.data as ImageNodeData;
      const url = d.ossUrl || d.blobUrl;
      if (url) out.push(url);
    } else if (p.type === "image-engine" || p.type === "three-view-engine") {
      const d = p.data as ImageEngineNodeData;
      if (d.runtime?.ossUrl) out.push(d.runtime.ossUrl);
    }
  }
  return Array.from(new Set(out));
}

/** 产品主图：优先取第一个上游 `image` 节点；否则回退到第一张上游参考图。 */
export function resolveProductMainImage(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  nodeId: string,
): { url: string; label: string } | null {
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p || p.type !== "image") continue;
    const d = p.data as ImageNodeData;
    const url = d.ossUrl || d.blobUrl;
    if (url) {
      return { url, label: d.label?.trim() || "产品主图" };
    }
  }
  const fallback = resolveUpstreamImageUrls(nodes, edges, nodeId)[0];
  if (!fallback) return null;
  return { url: fallback, label: "参考图" };
}
