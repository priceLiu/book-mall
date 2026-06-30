/** 分镜视频 1.0 · `sbv1-video-engine` 用户可见名 */
export const SBV1_VIDEO_COMPOSE_LABEL = "视频";

/** 分镜视频 1.0 节点尺寸与样式 token（壳层与 Pro2 共用 libtv-node-chrome） */

import {
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_MEDIA_CARD_SHELL_CLASS,
  LIBTV_MEDIA_STAGE_CLASS,
  LIBTV_DRAG_ANYWHERE_NODE_TYPES,
  LIBTV_NODE_HANDLE_CLASS,
  LIBTV_NODE_OUTER_CLASS,
  LIBTV_SQUARE_IMAGE_NODE_HEIGHT,
  LIBTV_SQUARE_IMAGE_NODE_MIN_HEIGHT,
  LIBTV_SQUARE_IMAGE_NODE_MIN_WIDTH,
  LIBTV_SQUARE_IMAGE_NODE_WIDTH,
} from "./libtv-node-chrome";
import {
  PRO2_DOCK_BORDER,
  PRO2_DOCK_SHELL_BG,
  PRO2_DOCK_TEXTAREA_CLASS,
} from "./story-pro2-node-chrome";

/** sbv1 图片 · 与 Pro2 图片同尺寸（LibTV 统一 · 350×350） */
export const SBV1_IMAGE_NODE_WIDTH = LIBTV_SQUARE_IMAGE_NODE_WIDTH;
export const SBV1_IMAGE_NODE_HEIGHT = LIBTV_SQUARE_IMAGE_NODE_HEIGHT;
export const SBV1_IMAGE_NODE_MIN_WIDTH = LIBTV_SQUARE_IMAGE_NODE_MIN_WIDTH;
export const SBV1_IMAGE_NODE_MIN_HEIGHT = LIBTV_SQUARE_IMAGE_NODE_MIN_HEIGHT;

/** 视频合成 · 默认 635×365（宽 stage · 与 Pro2 分镜视频组格解耦） */
export const SBV1_VIDEO_ENGINE_WIDTH = 635;
export const SBV1_VIDEO_ENGINE_HEIGHT = 365;
export const SBV1_VIDEO_ENGINE_MIN_WIDTH = 380;
/** 拉伸下限 */
export const SBV1_VIDEO_ENGINE_RESIZE_MIN_HEIGHT = 218;
/** @deprecated 使用 SBV1_VIDEO_ENGINE_HEIGHT */
export const SBV1_VIDEO_ENGINE_MIN_HEIGHT = SBV1_VIDEO_ENGINE_HEIGHT;

export const SBV1_CARD_SHELL_CLASS = LIBTV_MEDIA_CARD_SHELL_CLASS;
export const SBV1_MEDIA_STAGE_CLASS = LIBTV_MEDIA_STAGE_CLASS;
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

/** 视频 Dock 正文 · 与顶栏 px-2 对齐，去掉 Pro2 左侧额外 1 字符留白 */
export const SBV1_VIDEO_DOCK_TEXTAREA_INSET_CLASS =
  "min-h-0 pl-2 pr-4 py-3";
export const SBV1_REF_THUMB_BASE_CLASS =
  "group relative shrink-0 overflow-hidden rounded-md border border-white/10 bg-[#262626]";
export const SBV1_REF_THUMB_CLASS = `${SBV1_REF_THUMB_BASE_CLASS} size-10`;

export const SBV1_DOCK_TEXTAREA_CLASS =
  "min-h-[88px] w-full resize-none border-0 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-0";
