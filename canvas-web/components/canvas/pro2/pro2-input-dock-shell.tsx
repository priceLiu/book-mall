"use client";

import type { ReactNode } from "react";
import {
  PRO2_DOCK_BORDER,
  PRO2_DOCK_HEIGHT,
  PRO2_DOCK_SHELL_BG,
  PRO2_DOCK_WIDTH,
} from "@/lib/canvas/story-pro2-node-chrome";
import { cn } from "@/lib/utils";

export type Pro2InputDockShellProps = {
  /** 可滚动正文（textarea 等） */
  children: ReactNode;
  /** 固定顶栏（风格 / 标记 / 参考图图标，不随正文滚动） */
  header?: ReactNode;
  /** 固定底栏 + 页脚说明 */
  footer?: ReactNode;
  className?: string;
  left: number;
  top: number;
  dockClassName?: string;
  /** 默认 PRO2_DOCK_WIDTH；sbv1 视频引擎可对齐节点宽度 */
  width?: number;
};

/** 2.0 统一输入坞外壳（固定横向长方形 · 仅正文区滚动） */
export function Pro2InputDockShell({
  children,
  header,
  footer,
  className,
  left,
  top,
  dockClassName,
  width = PRO2_DOCK_WIDTH,
}: Pro2InputDockShellProps) {
  return (
    <div
      className={cn(
        "pro2-input-dock pointer-events-auto fixed z-[88]",
        dockClassName,
      )}
      style={{
        left,
        top,
        width,
        transform: "translate(-50%, 0)",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-2xl border shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl",
          className,
        )}
        style={{
          borderColor: PRO2_DOCK_BORDER,
          background: PRO2_DOCK_SHELL_BG,
          height: PRO2_DOCK_HEIGHT,
          maxHeight: PRO2_DOCK_HEIGHT,
        }}
      >
        {header}
        <div className="pro2-dock-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          {children}
        </div>
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Pro2DockContextBar({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex min-h-[44px] shrink-0 flex-wrap items-center gap-1.5 border-b border-white/[0.06] px-3 py-2">
      {children}
    </div>
  );
}

export function Pro2DockToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/[0.06] px-2 py-1.5">
      {children}
    </div>
  );
}

/** 节点卡片内嵌输入区（不浮动、不占节点下方额外空间） */
export function Pro2EmbeddedInputDock({
  children,
  header,
  footer,
  className,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "nodrag flex h-full min-h-0 flex-col overflow-hidden",
        className,
      )}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {header}
      <div className="pro2-dock-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>
      {footer ? <div className="shrink-0">{footer}</div> : null}
    </div>
  );
}
