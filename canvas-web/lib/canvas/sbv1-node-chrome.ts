export const SBV1_VIDEO_COMPOSE_LABEL = "视频合成";

/** 分镜视频 1.0 节点尺寸与样式 token（壳层与 Pro2 共用 libtv-node-chrome） */

import {
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_CARD_SHELL_CLASS,
  LIBTV_DRAG_ANYWHERE_NODE_TYPES,
  LIBTV_NODE_HANDLE_CLASS,
  LIBTV_NODE_OUTER_CLASS,
} from "./libtv-node-chrome";
import {
  PRO2_DOCK_BORDER,
  PRO2_DOCK_SHELL_BG,
  PRO2_DOCK_TEXTAREA_CLASS,
  PRO2_IMAGE_NODE_MIN_HEIGHT,
  PRO2_IMAGE_NODE_MIN_WIDTH,
  PRO2_IMAGE_NODE_WIDTH,
} from "./story-pro2-node-chrome";

export const SBV1_IMAGE_NODE_WIDTH = PRO2_IMAGE_NODE_WIDTH;
export const SBV1_IMAGE_NODE_HEIGHT = PRO2_IMAGE_NODE_MIN_HEIGHT + 28;
export const SBV1_IMAGE_NODE_MIN_WIDTH = PRO2_IMAGE_NODE_MIN_WIDTH;
export const SBV1_IMAGE_NODE_MIN_HEIGHT = PRO2_IMAGE_NODE_MIN_HEIGHT;

export const SBV1_VIDEO_ENGINE_WIDTH = 960;
/** 4:3 视频预览区高度（宽 960） */
export const SBV1_VIDEO_ENGINE_STAGE_HEIGHT = 720;
/** 标题栏 + 4:3 预览区 */
export const SBV1_VIDEO_ENGINE_MIN_HEIGHT = 760;

export const SBV1_CARD_SHELL_CLASS = LIBTV_CARD_SHELL_CLASS;
export const SBV1_CARD_DRAG_CLASS = LIBTV_CARD_DRAG_CLASS;
export const SBV1_DRAG_ANYWHERE_NODE_TYPES = LIBTV_DRAG_ANYWHERE_NODE_TYPES;
export const SBV1_NODE_OUTER_CLASS = LIBTV_NODE_OUTER_CLASS;
export const SBV1_NODE_HANDLE_CLASS = LIBTV_NODE_HANDLE_CLASS;

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
