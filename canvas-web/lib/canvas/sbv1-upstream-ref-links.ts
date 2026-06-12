import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import type { Sbv1ImageNodeData } from "./sbv1-workspace-types";

export type Sbv1UpstreamRefLink = {
  id: string;
  index: number;
  label: string;
  previewUrl?: string;
  sourceNodeId: string;
  edgeId: string;
};

function imageUrlFromSbv1Node(node: CanvasFlowNode): string | undefined {
  const d = node.data as unknown as Sbv1ImageNodeData;
  return d.ossUrl ?? d.blobUrl;
}

/** 解析 sbv1-video-engine 入边中 sbv1-image 上游，按边顺序编号 1…N */
export function resolveSbv1UpstreamRefLinks(
  engineNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): Sbv1UpstreamRefLink[] {
  const incoming = edges.filter(
    (e) =>
      e.target === engineNodeId &&
      (e.targetHandle === "in_ref" || !e.targetHandle),
  );
  const links: Sbv1UpstreamRefLink[] = [];
  let index = 0;
  for (const edge of incoming) {
    const source = nodes.find((n) => n.id === edge.source);
    if (!source || source.type !== "sbv1-image") continue;
    index += 1;
    const previewUrl = imageUrlFromSbv1Node(source);
    links.push({
      id: `sbv1-ref-${source.id}`,
      index,
      label: `图片 ${index}`,
      previewUrl,
      sourceNodeId: source.id,
      edgeId: edge.id,
    });
  }
  return links;
}
