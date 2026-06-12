/** 分镜视频 1.0 节点尺寸与样式 token（对齐 Pro2 dark chrome） */

import {
  PRO2_DOCK_BORDER,
  PRO2_DOCK_SHELL_BG,
  PRO2_DOCK_TEXTAREA_CLASS,
} from "./story-pro2-node-chrome";

export const SBV1_IMAGE_NODE_WIDTH = 280;
export const SBV1_IMAGE_NODE_HEIGHT = 360;
export const SBV1_IMAGE_NODE_MIN_WIDTH = 200;
export const SBV1_IMAGE_NODE_MIN_HEIGHT = 260;

export const SBV1_VIDEO_ENGINE_WIDTH = 960;
/** 4:3 视频预览区高度（宽 960） */
export const SBV1_VIDEO_ENGINE_STAGE_HEIGHT = 720;
/** 标题栏 + 4:3 预览区 */
export const SBV1_VIDEO_ENGINE_MIN_HEIGHT = 760;

/** 内层卡片（侧栏 + 须挂在外层 overflow-visible 容器上，避免 + 被裁切） */
export const SBV1_CARD_SHELL_CLASS =
  "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141418] shadow-lg";

export const SBV1_NODE_OUTER_CLASS =
  "relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-visible";

export const SBV1_NODE_HANDLE_CLASS =
  "!h-2.5 !w-2.5 !border-2 !border-[#141418] !bg-cyan-400";

export const SBV1_DOCK_SHELL_BG = "bg-[#1a1a1f]";
export const SBV1_DOCK_BORDER = "border-white/10";

/** 视频引擎内嵌 chat 输入框（图 1 · 对齐 Pro2 输入坞） */
export const SBV1_CHAT_INPUT_SHELL_CLASS =
  "nodrag relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-[0_8px_32px_rgba(0,0,0,0.35)]";
export const SBV1_CHAT_INPUT_SHELL_STYLE = {
  borderColor: PRO2_DOCK_BORDER,
  background: PRO2_DOCK_SHELL_BG,
} as const;
export const SBV1_CHAT_INPUT_TEXTAREA_CLASS = PRO2_DOCK_TEXTAREA_CLASS;
export const SBV1_REF_THUMB_CLASS =
  "group relative size-14 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/40";

export const SBV1_DOCK_TEXTAREA_CLASS =
  "min-h-[88px] w-full resize-none border-0 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-0";
