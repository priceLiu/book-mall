/**
 * LibTV 节点壳层 token（分镜视频 1.0 · 影视专业 2.0 共用）
 * 整卡拖动、侧 +、Dock、顶栏工具条须与此一致。
 */

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** 内层卡片（非媒体 · 文本 / 脚本 / 薄卡等） */
export const LIBTV_CONTROL_CARD_BG = "#141418";
export const LIBTV_CONTROL_CARD_SHELL_CLASS =
  "libtv-control-node-bg flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 shadow-lg";

/** 内层卡片（挂在外层 overflow-visible 容器上，避免 + 被裁切） */
export const LIBTV_CARD_SHELL_CLASS = LIBTV_CONTROL_CARD_SHELL_CLASS;

/** 媒体节点卡片（图片 / 视频 / 三视图） */
export const LIBTV_MEDIA_CARD_BG = "#262626";
export const LIBTV_MEDIA_CARD_SHELL_CLASS =
  "libtv-media-node-bg flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 shadow-lg";

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
export const LIBTV_MEDIA_FIT_VERSION = 6;

/** 生成图自适配 · 预览区（stage）长边目标 px（不含标题栏）· 约空态 350 的 2.5 倍 */
export const LIBTV_MEDIA_AUTO_FIT_LONG_EDGE = 875;

/** @deprecated 旧常量（偏小，会导致留边）。新代码请用按节点类型区分的上面两个。 */
export const LIBTV_MEDIA_NODE_HEADER_HEIGHT = LIBTV_IMAGE_NODE_HEADER_HEIGHT;

/**
 * LibTV 方形图片媒体卡默认尺寸（Pro2 图片/风格 · sbv1 图片 · 须一致）
 * 真源：`docs/libtv-unified-node-catalog.md` §1.3
 */
export const LIBTV_SQUARE_IMAGE_NODE_WIDTH = 350;
export const LIBTV_SQUARE_IMAGE_NODE_HEIGHT = 350;
export const LIBTV_SQUARE_IMAGE_NODE_MIN_WIDTH = 220;
export const LIBTV_SQUARE_IMAGE_NODE_MIN_HEIGHT = 220;

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

/** LibTV 节点壳层交互描边 · hover 2px #A2A2A2；选中 2px 保留版别色 */
export const LIBTV_NODE_BORDER_HOVER_COLOR = "#A2A2A2";

const LIBTV_NODE_BORDER_SELECTED_PRO2 = "rgba(167, 139, 250, 0.45)";
const LIBTV_NODE_BORDER_SELECTED_SBV1 = "rgba(34, 211, 238, 0.5)";
const LIBTV_NODE_BORDER_SELECTED_NEUTRAL = "rgba(255, 255, 255, 0.42)";

export type LibtvNodeBorderEdition = "pro2" | "sbv1" | "neutral";

export function libtvNodeBorderStyle(options: {
  selected?: boolean;
  hovered?: boolean;
  edition?: LibtvNodeBorderEdition;
}): CSSProperties | undefined {
  const { selected, hovered, edition = "pro2" } = options;
  if (selected) {
    const borderColor =
      edition === "sbv1"
        ? LIBTV_NODE_BORDER_SELECTED_SBV1
        : edition === "neutral"
          ? LIBTV_NODE_BORDER_SELECTED_NEUTRAL
          : LIBTV_NODE_BORDER_SELECTED_PRO2;
    return { borderWidth: 1.5, borderColor, borderStyle: "solid" };
  }
  if (hovered) {
    return {
      borderWidth: 1.5,
      borderColor: LIBTV_NODE_BORDER_HOVER_COLOR,
      borderStyle: "solid",
    };
  }
  return undefined;
}

export function libtvNodeInteractiveBorderClass(options: {
  selected?: boolean;
  hovered?: boolean;
  edition?: LibtvNodeBorderEdition;
}): string {
  const style = libtvNodeBorderStyle(options);
  if (!style) return "border border-white/10";
  return "border-solid";
}

/** 媒体节点壳层 className（含 hover / 选中描边） */
export function libtvMediaNodeShellClass(options: {
  selected?: boolean;
  hovered?: boolean;
  edition: LibtvNodeBorderEdition;
  className?: string;
}): string {
  const { selected, hovered, edition, className } = options;
  const borderStyle = libtvNodeBorderStyle({ selected, hovered, edition });
  return cn(
    LIBTV_MEDIA_CARD_SHELL_CLASS,
    LIBTV_CARD_DRAG_CLASS,
    libtvNodeInteractiveBorderClass({ selected, hovered, edition }),
    !borderStyle && "border border-white/10",
    className,
  );
}

/** 整卡可拖节点 type · 登记于 normalize-graph-nodes `PRO2_LIBTV_DRAG_ANYWHERE_TYPES` */
export const LIBTV_DRAG_ANYWHERE_NODE_TYPES = [
  "sbv1-image",
  "sbv1-video-engine",
  "story-pro2-image",
  "story-pro2-starter",
  "story-pro2-tag",
  "story-pro2-script-hub",
  "story-pro2-three-view",
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
/** lg 侧 + 半径（flow · 与 globals.css 88px 对齐） */
export const LIBTV_SIDE_PLUS_LG_RADIUS_FLOW = 44;
/** 拖线松手 · 侧 + 额外吸附容差（flow · 含磁吸沿边偏移） */
export const LIBTV_SIDE_PLUS_SNAP_PADDING_FLOW = 56;

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
export const LIBTV_INPUT_DOCK_SEND_BTN_CLASS =
  "nodrag flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40";

/** LibTV 媒体 stage 生成中扫光 · sbv1 / Pro1 列（cyan） */
export const LIBTV_MEDIA_GENERATING_CYAN_CLASS =
  "canvas-story-media-generating canvas-story-media-generating-pro border-cyan-400/50";

/** LibTV 媒体 stage 生成中扫光 · Pro2（violet） */
export const LIBTV_MEDIA_GENERATING_VIOLET_CLASS =
  "canvas-story-media-generating canvas-story-media-generating-pro2 border-violet-400/50";
