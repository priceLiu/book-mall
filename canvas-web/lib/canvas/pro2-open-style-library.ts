"use client";

import { openPlatformAssetHub } from "@/components/canvas/platform-asset-hub/platform-asset-hub-host";
import { useCanvasStore } from "./store";

/** 图片 / 三视图节点 · 打开平台 Hub「风格」并在选中后为该节点 spawn 风格素材 */
export function openPro2StyleLibraryForMediaNode(nodeId: string): void {
  useCanvasStore.getState().setPro2StyleLibImageNodeId(nodeId);
  openPlatformAssetHub({ section: "style" });
}

/** Dock · 打开平台 Hub「镜头描述」并写入当前节点 */
export function openPlatformCameraShotForDockNode(nodeId: string): void {
  useCanvasStore.getState().setPlatformAssetDockNodeId(nodeId);
  openPlatformAssetHub({ section: "camera-shot" });
}
