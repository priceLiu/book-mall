/**
 * LibTV 节点壳层 token（分镜视频 1.0 · 影视专业 2.0 共用）
 * 整卡拖动、侧 +、Dock、顶栏工具条须与此一致。
 */

/** 内层卡片（挂在外层 overflow-visible 容器上，避免 + 被裁切） */
export const LIBTV_CARD_SHELL_CLASS =
  "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141418] shadow-lg";

/** 整卡拖动光标（须配合无 dragHandle 节点） */
export const LIBTV_CARD_DRAG_CLASS = "cursor-grab active:cursor-grabbing";

/** 整卡可拖节点 type · 登记于 normalize-graph-nodes `PRO2_LIBTV_DRAG_ANYWHERE_TYPES` */
export const LIBTV_DRAG_ANYWHERE_NODE_TYPES = [
  "sbv1-image",
  "sbv1-video-engine",
  "story-pro2-image",
  "story-pro2-starter",
  "story-pro2-script-hub",
  "story-pro2-three-view",
  "story-pro2-style-asset",
  "story-pro2-frame",
] as const;

export const LIBTV_NODE_OUTER_CLASS =
  "relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-visible";

export const LIBTV_NODE_HANDLE_CLASS =
  "!h-2.5 !w-2.5 !border-2 !border-[#141418] !bg-cyan-400";

/** 画布底部磁吸 Dock 外壳（分镜 1.0 · 2.0 共用） */
export const LIBTV_CANVAS_DOCK_BAR_CLASS =
  "pointer-events-auto mx-auto flex h-20 items-end gap-3 rounded-3xl border border-white/[0.08] bg-[rgba(38,38,40,0.72)] px-4 pb-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl backdrop-saturate-150";

/** 节点下方浮动输入坞 · 外壳描边 / 背景（Pro2InputDockShell） */
export const LIBTV_INPUT_DOCK_BORDER = "rgba(255, 255, 255, 0.08)";
export const LIBTV_INPUT_DOCK_BG =
  "linear-gradient(165deg, rgba(22, 22, 28, 0.96) 0%, rgba(16, 16, 20, 0.98) 100%)";
export const LIBTV_INPUT_DOCK_SHELL_CLASS =
  "flex flex-col overflow-hidden rounded-2xl border shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl";
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
