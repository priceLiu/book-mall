"use client";

import { createContext, useContext, type ReactNode } from "react";

export type CanvasEdgeFocusContextValue = {
  /** 单选节点及其父组/子节点 id；用于入/出边高亮 */
  focusNodeIds: Set<string> | null;
};

const CanvasEdgeFocusContext = createContext<CanvasEdgeFocusContextValue>({
  focusNodeIds: null,
});

export function CanvasEdgeFocusProvider({
  focusNodeIds,
  children,
}: {
  focusNodeIds: Set<string> | null;
  children: ReactNode;
}) {
  return (
    <CanvasEdgeFocusContext.Provider value={{ focusNodeIds }}>
      {children}
    </CanvasEdgeFocusContext.Provider>
  );
}

export function useCanvasEdgeFocus(): CanvasEdgeFocusContextValue {
  return useContext(CanvasEdgeFocusContext);
}

/** 入边（target 在焦点内）· 上游蓝；出边（source 在焦点内）· 下游绿 */
export function resolveCanvasEdgeFocusTone(
  source: string,
  target: string,
  focusNodeIds: Set<string> | null,
): "up" | "down" | null {
  if (!focusNodeIds?.size) return null;
  if (focusNodeIds.has(target)) return "up";
  if (focusNodeIds.has(source)) return "down";
  return null;
}
