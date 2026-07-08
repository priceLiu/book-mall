import type { CanvasFlowNode, GroupNodeData } from "./types";

export function isSbv1ImageChild(n: CanvasFlowNode): boolean {
  return n.type === "sbv1-image";
}

export function sbv1ImageChildren(
  groupId: string,
  allNodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return allNodes.filter(
    (n) => n.parentId === groupId && isSbv1ImageChild(n),
  );
}

export function groupHasSbv1ImageChildren(
  groupId: string,
  allNodes: CanvasFlowNode[],
): boolean {
  return sbv1ImageChildren(groupId, allNodes).length > 0;
}

export function groupHasSbv1VideoChildren(
  groupId: string,
  allNodes: CanvasFlowNode[],
): boolean {
  return allNodes.some(
    (n) => n.parentId === groupId && n.type === "sbv1-video-engine",
  );
}

/** sbv1 画布内手动分组（子节点为 sbv1-image / sbv1-video-engine） */
export function isSbv1MediaGroup(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): boolean {
  if (node.type !== "group") return false;
  const d = node.data as GroupNodeData;
  // Pro2 媒体组（含分镜视频组内 sbv1-video-engine）走 Pro2MediaGroupToolbar，避免双顶栏
  if (d.pro2Kind) return false;
  if (d.sbv1Styled) return true;
  if (groupHasSbv1ImageChildren(node.id, allNodes)) return true;
  if (groupHasSbv1VideoChildren(node.id, allNodes)) return true;
  return false;
}
