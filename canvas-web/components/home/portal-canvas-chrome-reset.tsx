"use client";

import { useEffect } from "react";
import { useCanvasStore } from "@/lib/canvas/store";

/** 门户页挂载时清理编辑态浮层，避免从画布返回后工具条残留在首页 */
export function PortalCanvasChromeReset() {
  useEffect(() => {
    useCanvasStore.getState().clearPortalEditorChrome();
  }, []);
  return null;
}
