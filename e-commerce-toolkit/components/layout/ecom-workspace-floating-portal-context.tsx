"use client";

import { createContext, useContext, type RefObject } from "react";

const EcomWorkspaceFloatingPortalContext = createContext<RefObject<HTMLDivElement | null> | null>(
  null,
);

export function EcomWorkspaceFloatingPortalProvider({
  portalRef,
  children,
}: {
  portalRef: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return (
    <EcomWorkspaceFloatingPortalContext.Provider value={portalRef}>
      {children}
    </EcomWorkspaceFloatingPortalContext.Provider>
  );
}

/** 工作区右下角 Portal 锚点（收起态助手输入框对齐侧栏右缘） */
export function useEcomWorkspaceFloatingPortal(): RefObject<HTMLDivElement | null> | null {
  return useContext(EcomWorkspaceFloatingPortalContext);
}
