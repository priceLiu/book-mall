import type { CanvasFlowNode } from "./types";

/** Pro2 分镜视频组 · 组内 sbv1-video-engine 子格 */
export function isPro2VideoBoardChild(n: CanvasFlowNode): boolean {
  return (
    n.type === "sbv1-video-engine" &&
    (n.data as { pro2MediaRole?: string }).pro2MediaRole === "video"
  );
}

/** 分镜视频媒体组（spawn 自分镜图组时为 group + pro2Kind） */
export function isPro2VideoBoardGroup(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): boolean {
  if (node.type !== "group") return false;
  const d = node.data as { pro2Kind?: string };
  if (d.pro2Kind === "video-board") return true;
  return allNodes.some(
    (n) => n.parentId === node.id && isPro2VideoBoardChild(n),
  );
}

export function findPro2VideoBoardGroupForNode(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): CanvasFlowNode | null {
  if (isPro2VideoBoardGroup(node, allNodes)) return node;
  if (!isPro2VideoBoardChild(node)) return null;
  const groupId =
    node.parentId ??
    (node.data as { pro2GroupId?: string }).pro2GroupId ??
    undefined;
  if (!groupId) return null;
  const group = allNodes.find((n) => n.id === groupId);
  if (!group || !isPro2VideoBoardGroup(group, allNodes)) return null;
  return group;
}
