"use client";

import { createContext, useContext } from "react";

export type LibtvInputDockUi = {
  /** 浮动输入坞是否处于放大态；内嵌 Dock 默认 true */
  expanded: boolean;
};

const defaultValue: LibtvInputDockUi = { expanded: true };

export const LibtvInputDockUiContext =
  createContext<LibtvInputDockUi>(defaultValue);

export function useLibtvInputDockUi(): LibtvInputDockUi {
  return useContext(LibtvInputDockUiContext);
}
