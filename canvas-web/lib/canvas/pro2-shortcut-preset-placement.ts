import type { CanvasFlowNode } from "./types";
import type { Pro2ShortcutPresetId } from "./pro2-spawn-shortcut-presets";
import {
  LIBTV_AUDIO_TRACK_NODE_HEIGHT,
  LIBTV_AUDIO_TRACK_NODE_WIDTH,
  LIBTV_SQUARE_IMAGE_NODE_HEIGHT,
  LIBTV_SQUARE_IMAGE_NODE_WIDTH,
} from "./libtv-node-chrome";
import {
  PRO2_IMAGE_NODE_HEIGHT,
  PRO2_SCRIPT_NODE_HEIGHT,
  PRO2_TEXT_NODE_HEIGHT,
  PRO2_TEXT_NODE_WIDTH,
  PRO2_SCRIPT_NODE_WIDTH,
} from "./story-pro2-node-chrome";
import {
  SBV1_VIDEO_ENGINE_HEIGHT,
  SBV1_VIDEO_ENGINE_WIDTH,
} from "./sbv1-node-chrome";
import {
  SBV1_IMAGE_NODE_HEIGHT,
  SBV1_IMAGE_NODE_WIDTH,
} from "./sbv1-node-chrome";
import { flowViewportCenterFlow } from "./viewport-placement";

export const SHORTCUT_PRESET_SPAWN_GAP = 64;
const MAX_SHIFT_ITER = 24;

export const SHORTCUT_GROUP_PAD = 28;
export const SHORTCUT_GROUP_HEADER = 32;

type Rect = { x: number; y: number; w: number; h: number };

function parseNodeDim(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function nodeStyleDims(n: CanvasFlowNode): { w: number; h: number } {
  const style =
    typeof n.style === "object" && n.style
      ? (n.style as { width?: unknown; height?: unknown })
      : {};
  return {
    w: parseNodeDim(
      n.width ?? style.width ?? n.measured?.width,
      240,
    ),
    h: parseNodeDim(
      n.height ?? style.height ?? n.measured?.height,
      200,
    ),
  };
}

function isShortcutPresetGroup(n: CanvasFlowNode): boolean {
  if (n.type !== "group") return false;
  const d = n.data as { pro2ShortcutPreset?: boolean; label?: string };
  if (d.pro2ShortcutPreset) return true;
  const label = String(d.label ?? "");
  return label.startsWith("预设 -");
}

function groupOrigin(group: CanvasFlowNode, nodes: CanvasFlowNode[]): {
  x: number;
  y: number;
} {
  let x = group.position.x;
  let y = group.position.y;
  let cur = group.parentId;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const p = byId.get(cur);
    if (!p) break;
    x += p.position.x;
    y += p.position.y;
    cur = p.parentId;
  }
  return { x, y };
}

/** 组框与子节点绝对范围的并集（子节点撑出组框时也算占用） */
export function shortcutPresetGroupObstacleRect(
  group: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): Rect {
  const origin = groupOrigin(group, nodes);
  const box = nodeStyleDims(group);
  let minX = origin.x;
  let minY = origin.y;
  let maxX = origin.x + box.w;
  let maxY = origin.y + box.h;

  for (const c of nodes) {
    if (c.parentId !== group.id || c.type === "group") continue;
    const { w, h } = nodeStyleDims(c);
    const ax = origin.x + c.position.x;
    const ay = origin.y + c.position.y;
    minX = Math.min(minX, ax - SHORTCUT_GROUP_PAD);
    minY = Math.min(minY, ay - SHORTCUT_GROUP_PAD - SHORTCUT_GROUP_HEADER);
    maxX = Math.max(maxX, ax + w + SHORTCUT_GROUP_PAD);
    maxY = Math.max(maxY, ay + h + SHORTCUT_GROUP_PAD);
  }

  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function shouldSeparateCanvasGroup(n: CanvasFlowNode): boolean {
  if (n.type !== "group" || n.parentId) return false;
  if (n.id.startsWith("sc-group-")) return false;
  const d = n.data as {
    pro2ShortcutPreset?: boolean;
    pro2Styled?: boolean;
    sbv1Styled?: boolean;
    pro2Kind?: string;
    label?: string;
  };
  if (d.pro2ShortcutPreset || d.pro2Styled || d.sbv1Styled || d.pro2Kind) {
    return true;
  }
  return String(d.label ?? "").startsWith("预设");
}

function growGroupBoxToChildren(
  nodes: CanvasFlowNode[],
  group: CanvasFlowNode,
): CanvasFlowNode[] {
  const origin = groupOrigin(group, nodes);
  let maxX = origin.x;
  let maxY = origin.y;
  let hasChild = false;
  for (const c of nodes) {
    if (c.parentId !== group.id || c.type === "group") continue;
    hasChild = true;
    const { w, h } = nodeStyleDims(c);
    maxX = Math.max(maxX, origin.x + c.position.x + w + SHORTCUT_GROUP_PAD);
    maxY = Math.max(maxY, origin.y + c.position.y + h + SHORTCUT_GROUP_PAD);
  }
  if (!hasChild) return nodes;
  const needW = Math.ceil(maxX - origin.x);
  const needH = Math.ceil(maxY - origin.y);
  const cur = nodeStyleDims(group);
  if (cur.w + 0.5 >= needW && cur.h + 0.5 >= needH) return nodes;
  const width = Math.max(cur.w, needW);
  const height = Math.max(cur.h, needH);
  return nodes.map((n) =>
    n.id === group.id
      ? ({
          ...n,
          width,
          height,
          style: {
            ...(typeof n.style === "object" && n.style ? n.style : {}),
            width,
            height,
          },
        } as CanvasFlowNode)
      : n,
  );
}

/**
 * 快捷预设 / 媒体组：组框包住子节点，重叠的组按从左到右的顺序向右推开。
 * 视频生成后节点变宽、或复制组时组宽偏小，都会走到这里。
 */
export function reflowOverlappingCanvasGroups(
  nodes: CanvasFlowNode[],
  gap = SHORTCUT_PRESET_SPAWN_GAP,
): CanvasFlowNode[] {
  const targets = nodes.filter(shouldSeparateCanvasGroup);
  if (targets.length === 0) return nodes;

  let next = nodes;
  for (const g of targets) {
    next = growGroupBoxToChildren(next, g);
  }

  const ordered = next
    .filter(shouldSeparateCanvasGroup)
    .sort(
      (a, b) =>
        a.position.x - b.position.x ||
        a.position.y - b.position.y ||
        a.id.localeCompare(b.id),
    );

  const placed: Rect[] = [];
  const shifts = new Map<string, number>();
  for (const g of ordered) {
    const rect = shortcutPresetGroupObstacleRect(g, next);
    let dx = 0;
    for (let i = 0; i < MAX_SHIFT_ITER; i++) {
      const shifted: Rect = { ...rect, x: rect.x + dx };
      const hit = placed.find((o) => blocksHorizontal(shifted, o, gap));
      if (!hit) break;
      dx = hit.x + hit.w + gap - rect.x;
    }
    if (dx !== 0) shifts.set(g.id, dx);
    placed.push({ ...rect, x: rect.x + dx });
  }

  if (shifts.size === 0 && next === nodes) return nodes;
  if (shifts.size === 0) return next;

  return next.map((n) => {
    const dx = shifts.get(n.id);
    if (!dx) return n;
    return {
      ...n,
      position: { x: n.position.x + dx, y: n.position.y },
    };
  });
}

/** 垂直范围相交，且水平间距小于 gap */
function blocksHorizontal(a: Rect, b: Rect, gap: number): boolean {
  const yOverlap = !(a.y + a.h <= b.y || b.y + b.h <= a.y);
  if (!yOverlap) return false;
  return !(a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x);
}

function rectsOverlap(a: Rect, b: Rect, margin: number): boolean {
  return !(
    a.x + a.w + margin <= b.x ||
    b.x + b.w + margin <= a.x ||
    a.y + a.h + margin <= b.y ||
    b.y + b.h + margin <= a.y
  );
}

/** 快捷预设组外框（与 relayoutShortcutPresetGroup 一致） */
export function shortcutPresetGroupFootprint(
  contentW: number,
  contentH: number,
): { w: number; h: number } {
  return {
    w: contentW + SHORTCUT_GROUP_PAD * 2,
    h: contentH + SHORTCUT_GROUP_PAD * 2 + SHORTCUT_GROUP_HEADER,
  };
}

/** 子节点行宽 / 行高（未含组 padding） */
export function shortcutPresetContentSize(
  preset: Pro2ShortcutPresetId,
  gap: number,
): { w: number; h: number } {
  const textW = PRO2_TEXT_NODE_WIDTH;
  const imageW = LIBTV_SQUARE_IMAGE_NODE_WIDTH;
  const videoW = SBV1_VIDEO_ENGINE_WIDTH;

  switch (preset) {
    case "image-to-prompt":
      return {
        w: imageW + gap + textW,
        h: Math.max(PRO2_IMAGE_NODE_HEIGHT, PRO2_TEXT_NODE_HEIGHT),
      };
    case "video-to-prompt":
      return {
        w: videoW + gap + textW,
        h: Math.max(SBV1_VIDEO_ENGINE_HEIGHT, PRO2_TEXT_NODE_HEIGHT),
      };
    case "video-film-pull":
      return {
        w: videoW + gap + PRO2_SCRIPT_NODE_WIDTH,
        h: Math.max(SBV1_VIDEO_ENGINE_HEIGHT, PRO2_SCRIPT_NODE_HEIGHT),
      };
    case "text-to-music":
      return {
        w: textW + gap + LIBTV_AUDIO_TRACK_NODE_WIDTH,
        h: Math.max(PRO2_TEXT_NODE_HEIGHT, LIBTV_AUDIO_TRACK_NODE_HEIGHT),
      };
    case "text-to-video":
    default:
      return {
        w: textW + gap + videoW,
        h: Math.max(PRO2_TEXT_NODE_HEIGHT, SBV1_VIDEO_ENGINE_HEIGHT),
      };
  }
}

/** 与已有快捷预设组避让 · 优先在视口中心，冲突则向右平移 */
export function resolveShortcutPresetSpawnCenter(
  nodes: CanvasFlowNode[],
  baseCenter: { x: number; y: number },
  footprintW: number,
  footprintH: number,
  gap = SHORTCUT_PRESET_SPAWN_GAP,
): { x: number; y: number } {
  const presetGroups = nodes.filter(isShortcutPresetGroup);
  const obstacles = presetGroups.map((g) =>
    shortcutPresetGroupObstacleRect(g, nodes),
  );
  if (obstacles.length === 0) return baseCenter;

  const rightmost = Math.max(...obstacles.map((o) => o.x + o.w));
  let cx = rightmost + gap + footprintW / 2;
  const cy = baseCenter.y;

  for (let i = 0; i < MAX_SHIFT_ITER; i++) {
    const candidate: Rect = {
      x: cx - footprintW / 2,
      y: cy - footprintH / 2,
      w: footprintW,
      h: footprintH,
    };
    const hit = obstacles.find((o) => rectsOverlap(candidate, o, gap));
    if (!hit) return { x: cx, y: cy };
    cx = hit.x + hit.w + gap + footprintW / 2;
  }
  return { x: cx, y: cy };
}

/** relayout 后若与其它快捷组重叠，整组向右平移 */
export function nudgeShortcutPresetGroupClearOfPeers(
  nodes: CanvasFlowNode[],
  groupId: string,
  gap = SHORTCUT_PRESET_SPAWN_GAP,
): CanvasFlowNode[] {
  const group = nodes.find((n) => n.id === groupId);
  if (!group || !isShortcutPresetGroup(group)) return nodes;

  let selfRect = shortcutPresetGroupObstacleRect(group, nodes);
  const others = nodes
    .filter((n) => isShortcutPresetGroup(n) && n.id !== groupId)
    .map((n) => shortcutPresetGroupObstacleRect(n, nodes));

  if (others.length === 0) return nodes;

  let dx = 0;
  for (let i = 0; i < MAX_SHIFT_ITER; i++) {
    const shifted: Rect = { ...selfRect, x: selfRect.x + dx };
    const hit = others.find((o) => rectsOverlap(shifted, o, gap));
    if (!hit) break;
    dx = hit.x + hit.w + gap - selfRect.x;
  }
  if (dx === 0) return nodes;

  return nodes.map((n) =>
    n.id === groupId
      ? {
          ...n,
          position: { x: n.position.x + dx, y: n.position.y },
        }
      : n,
  );
}

export function flowCenterForShortcutPresetSpawn(
  preset: Pro2ShortcutPresetId,
  nodes: CanvasFlowNode[],
  gap: number,
  anchor?: { x: number; y: number },
): { x: number; y: number } {
  const content = shortcutPresetContentSize(preset, gap);
  const fp = shortcutPresetGroupFootprint(content.w, content.h);
  const base = anchor ?? flowViewportCenterFlow();
  return resolveShortcutPresetSpawnCenter(nodes, base, fp.w, fp.h);
}

/** 图(参考)生视频 · 与文生视频相同避让规则 */
export function flowCenterForImageToVideoPresetSpawn(
  nodes: CanvasFlowNode[],
  gap: number,
  edition: "pro2" | "sbv1",
  anchor?: { x: number; y: number },
): { x: number; y: number } {
  const imageW =
    edition === "sbv1" ? SBV1_IMAGE_NODE_WIDTH : LIBTV_SQUARE_IMAGE_NODE_WIDTH;
  const imageH =
    edition === "sbv1" ? SBV1_IMAGE_NODE_HEIGHT : LIBTV_SQUARE_IMAGE_NODE_HEIGHT;
  const videoW = SBV1_VIDEO_ENGINE_WIDTH;
  const contentW = imageW + gap + videoW;
  const contentH = Math.max(imageH, SBV1_VIDEO_ENGINE_HEIGHT);
  const fp = shortcutPresetGroupFootprint(contentW, contentH);
  const base = anchor ?? flowViewportCenterFlow();
  return resolveShortcutPresetSpawnCenter(nodes, base, fp.w, fp.h);
}
