import type { CanvasFlowNode } from "./types";

function isFrameBoardMediaChild(n: CanvasFlowNode): boolean {
  return (
    n.type === "story-pro2-image" &&
    (n.data as { pro2MediaRole?: string }).pro2MediaRole === "frame"
  );
}

/** 分镜图媒体组（spawn 自脚本 hub 时为 group + pro2Kind） */
export function isPro2FrameBoardGroup(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): boolean {
  if (node.type !== "group") return false;
  const d = node.data as { pro2Kind?: string };
  if (d.pro2Kind === "frame-board") return true;
  return allNodes.some(
    (n) => n.parentId === node.id && isFrameBoardMediaChild(n),
  );
}

export function findPro2FrameBoardGroupForNode(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): CanvasFlowNode | null {
  if (isPro2FrameBoardGroup(node, allNodes)) return node;

  if (!isFrameBoardMediaChild(node)) return null;

  const groupId =
    node.parentId ??
    (node.data as { pro2GroupId?: string }).pro2GroupId ??
    undefined;
  if (!groupId) return null;

  const group = allNodes.find((n) => n.id === groupId);
  if (!group || !isPro2FrameBoardGroup(group, allNodes)) return null;
  return group;
}

export function resolvePro2FrameBoardGroupSelection(
  allNodes: CanvasFlowNode[],
): CanvasFlowNode | null {
  const selected = allNodes.filter((n) => n.selected);
  if (!selected.length) return null;

  for (const n of selected) {
    if (isPro2FrameBoardGroup(n, allNodes)) return n;
  }

  for (const n of selected) {
    const group = findPro2FrameBoardGroupForNode(n, allNodes);
    if (group) return group;
  }

  return null;
}

/** 脚本 hub 下已存在的分镜图媒体组 */
export function findPro2FrameBoardGroupsForHub(
  hubNodeId: string,
  allNodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return allNodes.filter(
    (n) =>
      n.type === "group" &&
      (n.data as { pro2HubNodeId?: string }).pro2HubNodeId === hubNodeId &&
      isPro2FrameBoardGroup(n, allNodes),
  );
}

export function hubHasPro2FrameBoardGroup(
  hubNodeId: string,
  allNodes: CanvasFlowNode[],
): boolean {
  return findPro2FrameBoardGroupsForHub(hubNodeId, allNodes).length > 0;
}

/** 分镜列控制器 → 分镜图媒体组 id */
export function resolvePro2FrameBoardGroupIdForColumn(
  frameColumnId: string,
  allNodes: CanvasFlowNode[],
): string | null {
  const frameCol = allNodes.find((n) => n.id === frameColumnId);
  const visualId = (
    frameCol?.data as { pro2VisualGroupId?: string }
  )?.pro2VisualGroupId?.trim();
  if (visualId && allNodes.some((n) => n.id === visualId && n.type === "group")) {
    return visualId;
  }
  const byController = allNodes.find(
    (n) =>
      n.type === "group" &&
      (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
        frameColumnId &&
      isPro2FrameBoardGroup(n, allNodes),
  );
  return byController?.id ?? null;
}
