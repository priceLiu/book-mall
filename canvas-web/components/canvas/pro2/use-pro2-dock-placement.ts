"use client";

import {
  useLibtvDockFlowPlacement,
  type LibtvDockFlowPlacement,
} from "@/lib/canvas/libtv-dock-flow-placement";
import { PRO2_DOCK_WIDTH } from "@/lib/canvas/story-pro2-node-chrome";

export type Pro2DockPlacement = LibtvDockFlowPlacement;

/** 输入坞锚定在节点底边正中（flow 坐标 · 随画布 pan/zoom） */
export function usePro2DockPlacement(nodeId: string | null): Pro2DockPlacement | null {
  return useLibtvDockFlowPlacement(nodeId, { minFlowWidth: PRO2_DOCK_WIDTH });
}
