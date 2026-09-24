"use client";

import { useLayoutEffect } from "react";

import { installCanvasEditorPageNavGuards } from "@/lib/canvas/canvas-block-browser-nav";

/** `/canvas/[id]` 路由：尽早拦截鼠标侧键 / 触控板后退，避免误离编辑页 */
export function CanvasEditorNavGuard() {
  useLayoutEffect(() => installCanvasEditorPageNavGuards(), []);
  return null;
}
