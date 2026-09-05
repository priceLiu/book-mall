/**
 * LibTV 节点壳层 token（分镜视频 1.0 · 影视专业 2.0 共用）
 * 整卡拖动、侧 +、Dock、顶栏工具条须与此一致。
 */

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** 内层卡片（非媒体 · 文本 / 脚本 / 薄卡等） */
export const LIBTV_CONTROL_CARD_BG = "#141418";
export const LIBTV_CONTROL_CARD_SHELL_CLASS =
  "libtv-control-node-bg flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-solid shadow-lg";

/** 内层卡片（挂在外层 overflow-visible 容器上，避免 + 被裁切） */
export const LIBTV_CARD_SHELL_CLASS = LIBTV_CONTROL_CARD_SHELL_CLASS;

/** 媒体节点卡片（图片 / 视频 / 三视图） */
export const LIBTV_MEDIA_CARD_BG = "#262626";
export const LIBTV_MEDIA_CARD_SHELL_CLASS =
  "libtv-media-node-bg flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-solid shadow-lg";

/** 媒体节点预览区（与卡片同色） */
export const LIBTV_MEDIA_STAGE_CLASS =
  "libtv-media-node-bg relative min-h-0 flex-1 overflow-hidden";

/**
 * LibTV 媒体卡内标题栏占用高度（px）——须与实际渲染高度一致，否则自动适配后
 * stage 比例与图片真实比例不符，`object-contain` 会在四周留深色「边框/投影」。
 *
 * - 图片/三视图卡：右上 `size-7`(28) 预览按钮 + `py-2`(16) + `border-b`(1) ≈ 44
 * - 视频合成卡：右上 `p-1`(22) 图标按钮 + `py-2`(16) + `border-b`(1) ≈ 38
 */
export const LIBTV_IMAGE_NODE_HEADER_HEIGHT = 44;
export const LIBTV_VIDEO_NODE_HEADER_HEIGHT = 38;

/**
 * 媒体自适配「版本」——标题栏高度/适配算法变更时 +1。
 * 旧节点（含已手动拉伸/旧版本适配过的）下次进画布会按新算法**重算一次**外框，
 * 确保 `object-contain` 四边贴合、消除历史留边；重算后写回版本号，不再重复探测。
 */
export const LIBTV_MEDIA_FIT_VERSION = 15;

/** 生成图自适配 · 预览区（stage）长边目标 px（不含标题栏） */
export const LIBTV_MEDIA_AUTO_FIT_LONG_EDGE = 885;

/**
 * 画布 zoom=100% · 媒体 stage 标准（不含标题栏 · 真源见 `computeLibtvMediaBoxFromAspect`）
 * - 16:9 横版：630 × 354
 * - 9:16 竖版：354 × 630（宽 × stage 高）
 * - 1:1 方形：354 × 354
 */
export const LIBTV_MEDIA_STAGE_LANDSCAPE_WIDTH = 630;
export const LIBTV_MEDIA_STAGE_PORTRAIT_HEIGHT = 630;
export const LIBTV_MEDIA_STAGE_SQUARE_EDGE = 354;

/** 用户在 Dock 选择比例后，系统按比例调整外框的放大倍数（相对 legacy 基准） */
export const LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE = 1;

/** 与 `LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE` 同步；变更 scale 或顶边算法时 +1，用于一次性迁移旧外框 */
export const LIBTV_MEDIA_ASPECT_PRESET_SIZE_VERSION = 5;

/**
 * LibTV 媒体卡 · 三种固定 span（× SCALE 后为画布像素 @ zoom 100%）。
 * 横版：固定 stage 宽 → 算高；竖版：固定 stage 高 → 算宽；方形：固定边长。
 */
export const LIBTV_MEDIA_TOP_EDGE_LANDSCAPE_BASE =
  LIBTV_MEDIA_STAGE_LANDSCAPE_WIDTH;
export const LIBTV_MEDIA_TOP_EDGE_PORTRAIT_BASE =
  LIBTV_MEDIA_STAGE_PORTRAIT_HEIGHT;
export const LIBTV_MEDIA_TOP_EDGE_SQUARE_BASE = LIBTV_MEDIA_STAGE_SQUARE_EDGE;

/** @deprecated 旧常量（偏小，会导致留边）。新代码请用按节点类型区分的上面两个。 */
export const LIBTV_MEDIA_NODE_HEADER_HEIGHT = LIBTV_IMAGE_NODE_HEADER_HEIGHT;

/**
 * LibTV 方形图片媒体卡默认尺寸（Pro2 图片/风格 · sbv1 图片 · 须一致）
 * 真源：`docs/libtv-unified-node-catalog.md` §1.3
 */
export const LIBTV_SQUARE_IMAGE_NODE_WIDTH = LIBTV_MEDIA_STAGE_SQUARE_EDGE;
export const LIBTV_SQUARE_IMAGE_NODE_HEIGHT =
  LIBTV_MEDIA_STAGE_SQUARE_EDGE + LIBTV_IMAGE_NODE_HEADER_HEIGHT;
export const LIBTV_SQUARE_IMAGE_NODE_MIN_WIDTH = 220;
export const LIBTV_SQUARE_IMAGE_NODE_MIN_HEIGHT = 220;

/**
 * LibTV 音频轨节点（Pro2 · 迷你播放器横条 + 标题栏）
 * 宽 460 × 高 102（标题 ~28 + 播放器 74）
 */
export const LIBTV_AUDIO_TRACK_NODE_WIDTH = 460;
export const LIBTV_AUDIO_MINI_PLAYER_HEIGHT = 74;
/** @deprecated 旧波形区高度；新 UI 使用 LIBTV_AUDIO_MINI_PLAYER_HEIGHT */
export const LIBTV_AUDIO_TRACK_WAVEFORM_HEIGHT = LIBTV_AUDIO_MINI_PLAYER_HEIGHT;
export const LIBTV_AUDIO_TRACK_NODE_HEIGHT = 102;
export const LIBTV_AUDIO_TRACK_NODE_MIN_WIDTH = 220;
export const LIBTV_AUDIO_TRACK_NODE_MIN_HEIGHT = 102;
/** 音轨 UI 版本 · hydrate 时强制迁移外框 */
export const LIBTV_AUDIO_TRACK_LAYOUT_VERSION = 9;

/** 迷你播放器左侧图标 */
export const LIBTV_AUDIO_MINI_ICON_SRC = "/libtv/mini-audio-large.svg";

/** 音频节点强调色 · 与画布磁吸 Dock「上传」图标同色（emerald-400） */
export const LIBTV_AUDIO_ACCENT_COLOR = "#34d399";
export const LIBTV_AUDIO_ACCENT_MUTED_COLOR = "rgba(52, 211, 153, 0.35)";

/**
 * LibTV 横版视频媒体卡（Pro2 分镜视频组格 · sbv1 视频合成 · ≈3:2）
 */
export const LIBTV_VIDEO_MEDIA_NODE_WIDTH = 350;
export const LIBTV_VIDEO_MEDIA_NODE_HEIGHT = 232;
export const LIBTV_VIDEO_MEDIA_NODE_MIN_WIDTH = 260;
export const LIBTV_VIDEO_MEDIA_NODE_MIN_HEIGHT = 172;

/** 给定卡片宽度，预览区按 4:3（宽:高）计算整卡默认高度（历史 helper · 新节点勿用） */
export function libtvMediaNodeHeightForWidth(width: number): number {
  return LIBTV_MEDIA_NODE_HEADER_HEIGHT + Math.round((width * 3) / 4);
}

/** 整卡拖动光标（须配合无 dragHandle 节点） */
export const LIBTV_CARD_DRAG_CLASS = "cursor-grab active:cursor-grabbing";

/** LibTV 节点壳层交互描边 · 默认极浅白边（与输入坞一致）；选中时亮边加粗向外扩；hover 不改变描边 */
export const LIBTV_NODE_BORDER_DEFAULT_COLOR = "rgba(255, 255, 255, 0.08)";
export const LIBTV_NODE_BORDER_HOVER_COLOR = "#FFFFFF";
export const LIBTV_NODE_BORDER_DEFAULT_WIDTH = 1.5;
/** 选中时视觉目标描边（含向外扩的一圈）· 布局仍用 DEFAULT_WIDTH */
export const LIBTV_NODE_BORDER_HOVER_WIDTH = 3;
export const LIBTV_NODE_BORDER_SELECTED_WIDTH = 1.5;
export const LIBTV_NODE_BORDER_SELECTED_RING_OUTSET =
  LIBTV_NODE_BORDER_HOVER_WIDTH - LIBTV_NODE_BORDER_DEFAULT_WIDTH;
/** @deprecated 别名 · 选中外扩环 */
export const LIBTV_NODE_BORDER_HOVER_OUTSET =
  LIBTV_NODE_BORDER_SELECTED_RING_OUTSET;

const LIBTV_NODE_BORDER_SELECTED_PRO2 = "#FFFFFF";
const LIBTV_NODE_BORDER_SELECTED_SBV1 = "#22d3ee";
const LIBTV_NODE_BORDER_SELECTED_NEUTRAL = "#FFFFFF";

export type LibtvNodeBorderEdition = "pro2" | "sbv1" | "neutral" | "audio";

function libtvNodeSelectedRingColor(edition: LibtvNodeBorderEdition): string {
  if (edition === "sbv1") return LIBTV_NODE_BORDER_SELECTED_SBV1;
  if (edition === "audio") return LIBTV_AUDIO_ACCENT_COLOR;
  if (edition === "neutral") return LIBTV_NODE_BORDER_SELECTED_NEUTRAL;
  return LIBTV_NODE_BORDER_SELECTED_PRO2;
}

export function libtvNodeBorderStyle(options: {
  selected?: boolean;
  hovered?: boolean;
  edition?: LibtvNodeBorderEdition;
}): CSSProperties {
  const { selected, edition = "pro2" } = options;
  if (selected) {
    const ringColor = libtvNodeSelectedRingColor(edition);
    return {
      borderWidth: LIBTV_NODE_BORDER_DEFAULT_WIDTH,
      borderColor: ringColor,
      borderStyle: "solid",
      boxShadow: `0 0 0 ${LIBTV_NODE_BORDER_SELECTED_RING_OUTSET}px ${ringColor}, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`,
    };
  }
  return {
    borderWidth: LIBTV_NODE_BORDER_DEFAULT_WIDTH,
    borderColor: LIBTV_NODE_BORDER_DEFAULT_COLOR,
    borderStyle: "solid",
  };
}

export function libtvNodeInteractiveBorderClass(_options: {
  selected?: boolean;
  hovered?: boolean;
  edition?: LibtvNodeBorderEdition;
}): string {
  return "border border-solid";
}

/** 媒体节点壳层 className（含 hover / 选中描边） */
export function libtvMediaNodeShellClass(options: {
  selected?: boolean;
  hovered?: boolean;
  edition: LibtvNodeBorderEdition;
  className?: string;
}): string {
  const { selected, hovered, edition, className } = options;
  return cn(
    LIBTV_MEDIA_CARD_SHELL_CLASS,
    LIBTV_CARD_DRAG_CLASS,
    libtvNodeInteractiveBorderClass({ selected, hovered, edition }),
    className,
  );
}

/** 整卡可拖节点 type · 登记于 normalize-graph-nodes `PRO2_LIBTV_DRAG_ANYWHERE_TYPES` */
export const LIBTV_DRAG_ANYWHERE_NODE_TYPES = [
  "sbv1-image",
  "sbv1-video-engine",
  "story-pro2-image",
  "story-pro2-starter",
  "story-pro2-prompt",
  "story-pro2-tag",
  "story-pro2-script-hub",
  "story-pro2-three-view",
  "story-pro2-3d-desk",
  "story-pro2-style-asset",
  "story-pro2-audio",
  "story-pro2-frame",
  "video-preview",
  "jianying-auto-render-pro2",
] as const;

export const LIBTV_NODE_OUTER_CLASS =
  "relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-visible";

/** 侧栏 + 统一尺寸 / 层级（左右对称 · 不被节点内容遮挡） */
export const LIBTV_NODE_SIDE_PLUS_SIZE = "lg" as const;
export const LIBTV_NODE_SIDE_PLUS_LAYER_CLASS = "z-[20060]";
/** lg 侧 + 半径（flow · 与 globals.css 70px 对齐） */
export const LIBTV_SIDE_PLUS_LG_RADIUS_FLOW = 35;
/** lg 侧 + 直径（px · 屏上目标；default 薄卡仍为 44） */
export const LIBTV_SIDE_PLUS_LG_SIZE_PX = 70;
/** default 侧 + 直径（px · flow 100%） */
export const LIBTV_SIDE_PLUS_DEFAULT_SIZE_PX = 44;

/** 侧 + 屏上直径 · 随画布 zoom 缩放（与 viewport 内 + 圆一致） */
export function libtvSidePlusScreenDiameter(
  zoom: number,
  size: typeof LIBTV_NODE_SIDE_PLUS_SIZE = LIBTV_NODE_SIDE_PLUS_SIZE,
): number {
  const base =
    size === "lg"
      ? LIBTV_SIDE_PLUS_LG_SIZE_PX
      : LIBTV_SIDE_PLUS_DEFAULT_SIZE_PX;
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return base * z;
}
/** 拖线松手 · 侧 + 额外吸附容差（flow · 含磁吸沿边偏移） */
export const LIBTV_SIDE_PLUS_SNAP_PADDING_FLOW = 56;

/** 侧 + 沿边跟随 / 连线吸附 · 限定在节点竖向中间 1/3（上下各留 1/3） */
export function libtvSidePlusFollowVerticalBounds(boxHeight: number): {
  insetFromEdge: number;
  maxOffsetFromCenter: number;
} {
  const h = Math.max(0, boxHeight);
  return {
    insetFromEdge: h / 3,
    maxOffsetFromCenter: h / 6,
  };
}

/** 指针是否在侧 + 磁吸带内（纵向仅中间 1/3，避免 Dock 在节点下方仍触发跟随） */
export function pointerNearSidePlusMagnetEdge(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "top" | "bottom" | "left" | "right" | "height">,
  side: "left" | "right",
  thresholdPx: number,
  borderInwardPx = 8,
): boolean {
  const { insetFromEdge } = libtvSidePlusFollowVerticalBounds(rect.height);
  const minY = rect.top + insetFromEdge - thresholdPx;
  const maxY = rect.bottom - insetFromEdge + thresholdPx;
  if (clientY < minY || clientY > maxY) return false;
  if (side === "left") {
    if (clientX >= rect.left - thresholdPx && clientX < rect.left) return true;
    return clientX >= rect.left && clientX <= rect.left + borderInwardPx;
  }
  if (clientX > rect.right && clientX <= rect.right + thresholdPx) return true;
  return clientX >= rect.right - borderInwardPx && clientX <= rect.right;
}

export const LIBTV_NODE_HANDLE_CLASS =
  "!h-2.5 !w-2.5 !border-2 !border-[#141418] !bg-cyan-400";

/** 画布底部磁吸 Dock 外壳（分镜 1.0 · 2.0 共用） */
export const LIBTV_CANVAS_DOCK_BAR_CLASS =
  "pointer-events-auto mx-auto flex h-14 items-end gap-2 rounded-2xl border border-white/[0.08] bg-[rgba(34,34,36,0.94)] px-3 pb-2 shadow-[0_8px_28px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]";

/** 节点下方浮动输入坞 · 外壳描边 / 背景（Pro2InputDockShell） */
export const LIBTV_INPUT_DOCK_BORDER = "rgba(255, 255, 255, 0.08)";
export const LIBTV_INPUT_DOCK_BG = "#262626";
export const LIBTV_INPUT_DOCK_SHELL_CLASS =
  "flex flex-col overflow-hidden rounded-2xl border shadow-[0_16px_48px_rgba(0,0,0,0.45)]";
export const LIBTV_INPUT_DOCK_DIVIDER = "border-white/[0.06]";
export const LIBTV_INPUT_DOCK_TOOLBAR_ICON_CLASS =
  "nodrag rounded-md p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-40";
/** 与画布磁吸 Dock「上传」图标同色（pro2-canvas-toolbar · emerald-400） */
export const LIBTV_INPUT_DOCK_SEND_BTN_CLASS =
  "nodrag flex shrink-0 items-center justify-center rounded-full bg-emerald-400 text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40";
/** 输入坞内 textarea · 无边框（字号随画布 zoom · 见 libtvDockPromptFontScreenMetrics） */
export const LIBTV_INPUT_DOCK_TEXTAREA_CLASS =
  "nodrag w-full resize-none border-0 bg-transparent text-[length:var(--libtv-dock-prompt-font,15px)] leading-relaxed text-white placeholder:text-white/30 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-45";

/** LibTV 媒体 stage 生成中扫光 · sbv1 / Pro1 列（cyan） */
export const LIBTV_MEDIA_GENERATING_CYAN_CLASS =
  "canvas-story-media-generating canvas-story-media-generating-pro border-cyan-400/50";

/** LibTV 媒体 stage 生成中扫光 · Pro2（violet） */
export const LIBTV_MEDIA_GENERATING_VIOLET_CLASS =
  "canvas-story-media-generating canvas-story-media-generating-pro2 border-violet-400/50";
