import type { CanvasFlowNode, GroupNodeData, Pro2MediaGroupKind } from "./types";
import { GROUP_COLOR_PRESETS } from "./types";
import { isSbv1MediaGroup } from "./sbv1-media-group-meta";

/** Pro2 媒体组子节点（三视图 / 分镜图 / 分镜视频占位） */
export function isPro2MediaChildNode(n: CanvasFlowNode): boolean {
  return n.type === "story-pro2-three-view" || n.type === "story-pro2-image";
}

/** 根据子节点推断媒体组类型 */
export function inferPro2MediaGroupKind(
  allNodes: CanvasFlowNode[],
  childIds: string[],
): Pro2MediaGroupKind | null {
  const children = allNodes.filter((n) => childIds.includes(n.id));
  if (!children.length) return null;
  if (!children.every(isPro2MediaChildNode)) return null;

  const hasThreeView = children.some(
    (n) =>
      n.type === "story-pro2-three-view" ||
      (n.type === "story-pro2-image" &&
        (n.data as { pro2MediaRole?: string }).pro2MediaRole ===
          "character-three-view"),
  );
  if (hasThreeView) return "character-board";

  const hasScene = children.some(
    (n) =>
      n.type === "story-pro2-image" &&
      (n.data as { pro2MediaRole?: string }).pro2MediaRole === "scene",
  );
  if (hasScene) return "scene-board";

  const hasFrame = children.some(
    (n) =>
      n.type === "story-pro2-image" &&
      (n.data as { pro2MediaRole?: string }).pro2MediaRole === "frame",
  );
  if (hasFrame || children.every((n) => n.type === "story-pro2-image")) {
    return "frame-board";
  }

  return "character-board";
}

export function pro2MediaGroupDefaultLabel(
  kind: Pro2MediaGroupKind,
  custom?: string,
): string {
  const t = custom?.trim();
  if (t) return t;
  if (kind === "character-board") return "三视图";
  if (kind === "scene-board") return "场景图";
  if (kind === "frame-board") return "分镜图";
  return "分镜视频";
}

/** 媒体组边框色：用户选色仅影响边框，背景保持暗色点阵 */
export function pro2MediaGroupBorderColor(
  color: string | undefined,
  selected?: boolean,
  hovered?: boolean,
): string {
  const c = color?.trim() || GROUP_COLOR_PRESETS[2];
  if (!c.startsWith("#") || c.length !== 7) {
    if (selected) return "rgba(255,255,255,0.2)";
    if (hovered) return "rgba(255,255,255,0.14)";
    return "rgba(255,255,255,0.08)";
  }
  if (selected) return c;
  if (hovered) return `${c}99`;
  return `${c}66`;
}

/** 为缺少 pro2Kind 的 Pro2 媒体组补齐元数据 */
export function reconcilePro2MediaGroupMetadata(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  let changed = false;
  const next = nodes.map((n) => {
    if (n.type !== "group") return n;
    const d = n.data as GroupNodeData;
    if (d.pro2Kind) return n;

    const childIds = nodes
      .filter((c) => c.parentId === n.id && isPro2MediaChildNode(c))
      .map((c) => c.id);
    if (!childIds.length) return n;

    const kind = inferPro2MediaGroupKind(nodes, childIds);
    if (!kind) return n;

    changed = true;
    return {
      ...n,
      data: {
        ...d,
        pro2Kind: kind,
        label: pro2MediaGroupDefaultLabel(kind, d.label),
        color: d.color || GROUP_COLOR_PRESETS[2],
      },
    } as CanvasFlowNode;
  });
  return changed ? next : nodes;
}

export function groupHasPro2MediaChildren(
  groupId: string,
  allNodes: CanvasFlowNode[],
): boolean {
  return allNodes.some(
    (n) => n.parentId === groupId && isPro2MediaChildNode(n),
  );
}

/** 统一判定：是否走图1 暗色组壳（媒体组 / 手动打的 Pro2 组） */
export function isPro2StyledGroup(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): boolean {
  if (node.type !== "group") return false;
  const d = node.data as GroupNodeData;
  if (d.pro2Kind || d.pro2Styled || d.pro2ShortcutPreset) return true;
  return groupHasPro2MediaChildren(node.id, allNodes);
}

const PRO2_MEDIA_GROUP_Z_BASE = 5;
const PRO2_MEDIA_GROUP_Z_SELECTED = 5;
/** 高于 `.react-flow__edges`（globals.css · 10），连线可见但不压住图片 */
const PRO2_MEDIA_GROUP_CHILD_Z_BASE = 15;
const PRO2_MEDIA_GROUP_CHILD_Z_SELECTED = 1201;

/** 选中媒体组时子图叠在其它节点之上；组框底色保持低于连线层 */
export function syncPro2MediaGroupZIndex(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const isStyledMediaGroup = (n: CanvasFlowNode) =>
    n.type === "group" &&
    (isPro2StyledGroup(n, nodes) || isSbv1MediaGroup(n, nodes));

  const selectedGroup = nodes.find(
    (n) => n.type === "group" && n.selected && isStyledMediaGroup(n),
  );
  const selectedId = selectedGroup?.id;
  const styledGroupIds = new Set(
    nodes.filter(isStyledMediaGroup).map((n) => n.id),
  );
  if (!styledGroupIds.size) return nodes;

  let changed = false;
  const next = nodes.map((n) => {
    if (n.type === "group" && styledGroupIds.has(n.id)) {
      const z =
        n.id === selectedId ? PRO2_MEDIA_GROUP_Z_SELECTED : PRO2_MEDIA_GROUP_Z_BASE;
      if (n.zIndex === z) return n;
      changed = true;
      return { ...n, zIndex: z };
    }
    if (n.parentId && styledGroupIds.has(n.parentId)) {
      const z =
        n.parentId === selectedId
          ? PRO2_MEDIA_GROUP_CHILD_Z_SELECTED
          : PRO2_MEDIA_GROUP_CHILD_Z_BASE;
      if (n.zIndex === z) return n;
      changed = true;
      return { ...n, zIndex: z };
    }
    return n;
  });
  return changed ? next : nodes;
}
