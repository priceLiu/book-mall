"use client";

import type { ReactNode } from "react";
import {
  armPro2NodeScrollDragGuard,
  disarmPro2NodeScrollDragGuard,
} from "@/lib/canvas/pro2-node-scroll";
import { cn } from "@/lib/utils";

/** 剧本 / 文本节点内可滚动区：整区可拖节点 · 滚动条单独 nodrag */
export function Pro2NodeScrollArea({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "pro2-node-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto",
        className,
      )}
      onPointerDown={(e) => {
        armPro2NodeScrollDragGuard(e.currentTarget, e.clientX);
      }}
      onPointerUp={(e) => {
        disarmPro2NodeScrollDragGuard(e.currentTarget);
      }}
      onPointerCancel={(e) => {
        disarmPro2NodeScrollDragGuard(e.currentTarget);
      }}
    >
      {children}
    </div>
  );
}
