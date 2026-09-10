"use client";

import { useEffect } from "react";

import { installCanvasSiteNavGuards } from "@/lib/canvas/canvas-block-browser-nav";

/** 非编辑页可选挂载；编辑页请用 canvas-page-client 内的 installCanvasEditorPageNavGuards */
export function CanvasSiteNavGuard() {
  useEffect(() => installCanvasSiteNavGuards(), []);
  return null;
}
