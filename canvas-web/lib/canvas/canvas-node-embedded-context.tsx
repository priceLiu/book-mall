"use client";

import { createContext, useContext } from "react";

/**
 * 为 true 时表示节点 UI 嵌在画布外（如 Pro2 右侧检视面板），
 * 须跳过 NodeResizer / Handle 等依赖 ReactFlowProvider 的组件。
 */
const CanvasNodeEmbeddedContext = createContext(false);

export function CanvasNodeEmbeddedProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CanvasNodeEmbeddedContext.Provider value>
      {children}
    </CanvasNodeEmbeddedContext.Provider>
  );
}

export function useCanvasNodeEmbedded(): boolean {
  return useContext(CanvasNodeEmbeddedContext);
}
