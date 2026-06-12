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

/** sbv1 画布内手动分组（子节点为 sbv1-image / sbv1-video-engine） */
export function isSbv1MediaGroup(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): boolean {
  if (node.type !== "group") return false;
  const d = node.data as GroupNodeData;
  if (d.sbv1Styled) return true;
  return groupHasSbv1ImageChildren(node.id, allNodes);
}
