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
import { flowPositionAtViewportCenter } from "./viewport-placement";

export const SHORTCUT_PRESET_SPAWN_GAP = 64;
const MAX_SHIFT_ITER = 24;

const SHORTCUT_GROUP_PAD = 28;
const SHORTCUT_GROUP_HEADER = 32;

type Rect = { x: number; y: number; w: number; h: number };

function nodeRect(n: CanvasFlowNode): Rect {
  const style =
    typeof n.style === "object" && n.style
      ? (n.style as { width?: number; height?: number })
      : {};
  const w = Number(n.width ?? style.width ?? n.measured?.width ?? 240);
  const h = Number(n.height ?? style.height ?? n.measured?.height ?? 200);
  return { x: n.position.x, y: n.position.y, w, h };
}

function rectsOverlap(a: Rect, b: Rect, margin: number): boolean {
  return !(
    a.x + a.w + margin <= b.x ||
    b.x + b.w + margin <= a.x ||
    a.y + a.h + margin <= b.y ||
    b.y + b.h + margin <= a.y
  );
}

function isShortcutPresetGroup(n: CanvasFlowNode): boolean {
  return (
    n.type === "group" &&
    Boolean((n.data as { pro2ShortcutPreset?: boolean }).pro2ShortcutPreset)
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
  const obstacles = nodes.filter(isShortcutPresetGroup).map(nodeRect);
  if (obstacles.length === 0) return baseCenter;

  let cx = baseCenter.x;
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

export function flowCenterForShortcutPresetSpawn(
  preset: Pro2ShortcutPresetId,
  nodes: CanvasFlowNode[],
  gap: number,
  anchor?: { x: number; y: number },
): { x: number; y: number } {
  const content = shortcutPresetContentSize(preset, gap);
  const fp = shortcutPresetGroupFootprint(content.w, content.h);
  const base =
    anchor ??
    flowPositionAtViewportCenter("story-pro2-starter") ?? { x: 420, y: 280 };
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
  const base =
    anchor ??
    flowPositionAtViewportCenter("story-pro2-starter") ?? { x: 420, y: 280 };
  return resolveShortcutPresetSpawnCenter(nodes, base, fp.w, fp.h);
}
