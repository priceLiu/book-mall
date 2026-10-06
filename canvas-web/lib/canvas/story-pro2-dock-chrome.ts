/**
 * Pro2 输入坞 flow 尺寸（依赖 libtv-dock-scale · 勿被 types / media-node-size 直接引用）
 */

import {
  LIBTV_DOCK_EXPAND_FACTOR,
  libtvDockFlowSize,
} from "@/lib/canvas/libtv-dock-scale";

export {
  LIBTV_DOCK_EXPAND_FACTOR as PRO2_DOCK_EXPAND_FACTOR,
  LIBTV_DOCK_FLOW_HEIGHT as PRO2_DOCK_HEIGHT,
  LIBTV_DOCK_FLOW_WIDTH as PRO2_DOCK_WIDTH,
  libtvDockFlowSize,
} from "@/lib/canvas/libtv-dock-scale";

const _baseDock = libtvDockFlowSize();

/** 输入坞放大态：宽度不变，仅增高 prompt 区 */
export const PRO2_DOCK_WIDTH_EXPANDED = _baseDock.w;
export const PRO2_DOCK_HEIGHT_EXPANDED = Math.round(
  _baseDock.h * LIBTV_DOCK_EXPAND_FACTOR,
);
