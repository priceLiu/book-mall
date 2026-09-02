"use client";

import { useEffect } from "react";

import { installCanvasSiteNavGuards } from "@/lib/canvas/canvas-block-browser-nav";

/** 画布整站 · 禁止浏览器后退/前进（侧键、触控板手势、history.back） */
export function CanvasSiteNavGuard() {
  useEffect(() => installCanvasSiteNavGuards(), []);
  return null;
}
