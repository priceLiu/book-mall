"use client";

import { createContext, useContext } from "react";

export type LibtvInputDockUi = {
  /** 浮动输入坞是否处于放大态；内嵌 Dock 默认 true */
  expanded: boolean;
  /** 正文区 contentZoom（顶/底栏不参与） */
  contentZoom: number;
  /** 外壳 invScale × 画布 zoom · 用于底栏/顶栏固定屏上字号 */
  shellScreenScale: number;
  /** 当前 React Flow 画布 zoom */
  canvasZoom: number;
};

const defaultValue: LibtvInputDockUi = {
  expanded: true,
  contentZoom: 1,
  shellScreenScale: 1,
  canvasZoom: 1,
};

export const LibtvInputDockUiContext =
  createContext<LibtvInputDockUi>(defaultValue);

export function useLibtvInputDockUi(): LibtvInputDockUi {
  return useContext(LibtvInputDockUiContext);
}
