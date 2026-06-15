"use client";

import {
  useLibtvDockFlowPlacement,
  type LibtvDockFlowPlacement,
} from "@/lib/canvas/libtv-dock-flow-placement";
import { SBV1_VIDEO_ENGINE_WIDTH } from "@/lib/canvas/sbv1-node-chrome";
import { PRO2_DOCK_WIDTH } from "@/lib/canvas/story-pro2-node-chrome";

export type Sbv1DockPlacement = LibtvDockFlowPlacement;

/** 视频引擎输入坞 · 锚定在节点底边正中（flow 坐标） */
export function useSbv1DockPlacement(nodeId: string | null): Sbv1DockPlacement | null {
  return useLibtvDockFlowPlacement(nodeId, {
    minFlowWidth: PRO2_DOCK_WIDTH,
    defaultNodeWidth: SBV1_VIDEO_ENGINE_WIDTH,
  });
}
