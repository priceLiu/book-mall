import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import type { ImageEngineNodeData, ImageNodeData } from "./types";
import { pickRuntimeImagePreviewUrl } from "./task-media-url";

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
  if (
    node.type === "sbv1-image" ||
    node.type === "story-pro2-image" ||
    node.type === "story-pro2-three-view"
  ) {
    const d = node.data as unknown as ImageNodeData & {
      runtime?: { ossUrl?: string; ephemeralUrl?: string };
      modelKey?: string;
    };
    return (
      pickRuntimeImagePreviewUrl(d.runtime, d.modelKey) ??
      d.runtime?.ossUrl ??
      d.ossUrl ??
      d.blobUrl
    );
  }
  if (node.type === "image-engine" || node.type === "three-view-engine") {
    const d = node.data as unknown as ImageEngineNodeData & {
      ossUrl?: string;
      blobUrl?: string;
    };
    return (
      pickRuntimeImagePreviewUrl(d.runtime, d.modelKey) ??
      d.runtime?.ossUrl ??
      d.ossUrl ??
      d.blobUrl
    );
  }
  return undefined;
}

/** 入边是否应计入视频引擎参考图（含历史误标 in_text 的图片连线） */
export function edgeMatchesSbv1VideoRefInput(
  edge: CanvasFlowEdge,
  engineNodeId: string,
  nodes: CanvasFlowNode[],
): boolean {
  if (edge.target !== engineNodeId) return false;
  if (edge.targetHandle === "in_motion_video") return false;
  if (edge.targetHandle === "in_ref" || !edge.targetHandle) return true;
  const source = nodes.find((n) => n.id === edge.source);
  if (
    source &&
    (isSbv1VideoEngineRefImageNode(source) || source.type === "group")
  ) {
    return (
      edge.targetHandle === "in_text" || edge.targetHandle === "default"
    );
  }
  return false;
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
  const incoming = edges.filter((e) =>
    edgeMatchesSbv1VideoRefInput(e, engineNodeId, nodes),
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
