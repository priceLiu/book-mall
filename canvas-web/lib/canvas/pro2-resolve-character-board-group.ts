import type { CanvasFlowNode } from "./types";

function isThreeViewMediaChild(n: CanvasFlowNode): boolean {
  if (n.type === "story-pro2-three-view") return true;
  return (
    n.type === "story-pro2-image" &&
    (n.data as { pro2MediaRole?: string }).pro2MediaRole ===
      "character-three-view"
  );
}

/** 人物三视图媒体组（spawn 自脚本 hub 时为 group + pro2Kind） */
export function isPro2CharacterBoardGroup(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): boolean {
  if (node.type !== "group") return false;
  const d = node.data as { pro2Kind?: string };
  if (d.pro2Kind === "character-board") return true;
  return allNodes.some(
    (n) => n.parentId === node.id && isThreeViewMediaChild(n),
  );
}

export function findPro2CharacterBoardGroupForNode(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): CanvasFlowNode | null {
  if (isPro2CharacterBoardGroup(node, allNodes)) return node;

  if (!isThreeViewMediaChild(node)) return null;

  const groupId =
    node.parentId ??
    (node.data as { pro2GroupId?: string }).pro2GroupId ??
    undefined;
  if (!groupId) return null;

  const group = allNodes.find((n) => n.id === groupId);
  if (!group || !isPro2CharacterBoardGroup(group, allNodes)) return null;
  return group;
}

export function resolvePro2CharacterBoardGroupSelection(
  allNodes: CanvasFlowNode[],
): CanvasFlowNode | null {
  const selected = allNodes.filter((n) => n.selected);
  if (!selected.length) return null;

  for (const n of selected) {
    if (isPro2CharacterBoardGroup(n, allNodes)) return n;
  }

  for (const n of selected) {
    const group = findPro2CharacterBoardGroupForNode(n, allNodes);
    if (group) return group;
  }

  for (const n of selected) {
    if (n.type !== "story-pro2-character") continue;
    const visualGroupId = (n.data as { pro2VisualGroupId?: string })
      .pro2VisualGroupId;
    if (!visualGroupId) continue;
    const group = allNodes.find((g) => g.id === visualGroupId);
    if (group && isPro2CharacterBoardGroup(group, allNodes)) return group;
  }

  return null;
}
