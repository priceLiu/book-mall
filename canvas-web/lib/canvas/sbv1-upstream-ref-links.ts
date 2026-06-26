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

/**
 * 可作为 sbv1-video-engine 参考图上游的 LibTV 图片节点。
 * 与 分镜视频 1.0 对齐：除 sbv1-image 外，影视专业 2.0 的图片节点
 * （story-pro2-image，含组内分镜图 role=frame；story-pro2-three-view）同样可被 @ 引用与生成。
 */
export function isSbv1VideoEngineRefImageNode(
  node: Pick<CanvasFlowNode, "type"> | undefined,
): boolean {
  if (!node) return false;
  return (
    node.type === "sbv1-image" ||
    node.type === "story-pro2-image" ||
    node.type === "story-pro2-three-view"
  );
}

function imageUrlFromRefNode(node: CanvasFlowNode): string | undefined {
  const d = node.data as unknown as Sbv1ImageNodeData;
  return d.ossUrl ?? d.blobUrl;
}

/**
 * 解析 sbv1-video-engine 入边中的图片上游，按边顺序编号 1…N。
 * - 直连图片节点（sbv1-image / story-pro2-image / story-pro2-three-view）
 * - 直连「组」节点时下钻枚举组内图片子节点（分镜图组等），与组展开行为对齐
 */
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
  const seen = new Set<string>();
  let index = 0;
  const pushImage = (source: CanvasFlowNode, edgeId: string) => {
    if (seen.has(source.id)) return;
    seen.add(source.id);
    index += 1;
    links.push({
      id: `sbv1-ref-${source.id}`,
      index,
      label: `图片 ${index}`,
      previewUrl: imageUrlFromRefNode(source),
      sourceNodeId: source.id,
      edgeId,
    });
  };
  for (const edge of incoming) {
    const source = nodes.find((n) => n.id === edge.source);
    if (!source) continue;
    if (isSbv1VideoEngineRefImageNode(source)) {
      pushImage(source, edge.id);
      continue;
    }
    if (source.type === "group") {
      for (const child of nodes) {
        if (child.parentId !== source.id) continue;
        if (!isSbv1VideoEngineRefImageNode(child)) continue;
        pushImage(child, edge.id);
      }
    }
  }
  return links;
}
