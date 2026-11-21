"use client";

import { createContext, useContext, type RefObject } from "react";

const EcomWorkspaceAssistantSeamContext = createContext<RefObject<HTMLDivElement | null> | null>(
  null,
);

export function EcomWorkspaceAssistantSeamProvider({
  seamRef,
  children,
}: {
  seamRef: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return (
    <EcomWorkspaceAssistantSeamContext.Provider value={seamRef}>
      {children}
    </EcomWorkspaceAssistantSeamContext.Provider>
  );
}

/** 中栏与右栏接缝锚点（边缘切钮 Portal，避免 overflow 裁切） */
export function useEcomWorkspaceAssistantSeam(): RefObject<HTMLDivElement | null> | null {
  return useContext(EcomWorkspaceAssistantSeamContext);
}