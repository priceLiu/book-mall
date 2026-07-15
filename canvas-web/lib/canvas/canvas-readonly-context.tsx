"use client";

import { createContext, useContext } from "react";

const CanvasReadonlyContext = createContext(false);

/** 模板预览 / 门户只读画布：禁止写 zustand、禁止浮动编辑工具条 */
export function CanvasReadonlyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CanvasReadonlyContext.Provider value={true}>
      {children}
    </CanvasReadonlyContext.Provider>
  );
}

export function useCanvasReadonly(): boolean {
  return useContext(CanvasReadonlyContext);
}
