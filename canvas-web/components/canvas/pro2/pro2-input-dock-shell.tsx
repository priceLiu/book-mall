"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  LIBTV_INPUT_DOCK_BG,
  LIBTV_INPUT_DOCK_BORDER,
  LIBTV_INPUT_DOCK_DIVIDER,
  LIBTV_INPUT_DOCK_SHELL_CLASS,
} from "@/lib/canvas/libtv-node-chrome";
import type { LibtvDockFlowPlacement } from "@/lib/canvas/libtv-dock-flow-placement";
import {
  PRO2_DOCK_HEIGHT,
  PRO2_DOCK_HEIGHT_EXPANDED,
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
  flowAnchor: LibtvDockFlowPlacement;
  dockClassName?: string;
  /** 默认 flowAnchor.flowW */
  width?: number;
  /** 拖动节点时隐藏（仍挂载 · 保持锚点跟随） */
  hidden?: boolean;
};

function useReactFlowViewportEl(): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const pick = () =>
      document.querySelector(
        ".canvas-flow-wrap .react-flow__viewport",
      ) as HTMLElement | null;
    setEl(pick());
  }, []);
  return el;
}

/** 2.0 统一输入坞外壳（flow 坐标 · 锚定节点下方 · 随画布 pan/zoom） */
export function Pro2InputDockShell({
  children,
  header,
  footer,
  className,
  flowAnchor,
  dockClassName,
  width,
  hidden = false,
}: Pro2InputDockShellProps) {
  const viewportEl = useReactFlowViewportEl();
  const [expanded, setExpanded] = useState(false);
  const dockW = width ?? flowAnchor.flowW;
  const dockHeight = expanded ? PRO2_DOCK_HEIGHT_EXPANDED : PRO2_DOCK_HEIGHT;

  if (!viewportEl) return null;

  return createPortal(
    <div
      className={cn(
        "pro2-input-dock pointer-events-auto absolute z-[1000]",
        dockClassName,
      )}
      style={{
        left: flowAnchor.flowX,
        top: flowAnchor.flowY,
        width: dockW,
        transform: "translate(-50%, 0)",
        visibility: hidden ? "hidden" : "visible",
        pointerEvents: hidden ? "none" : "auto",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          LIBTV_INPUT_DOCK_SHELL_CLASS,
          "relative",
          className,
        )}
        style={{
          borderColor: LIBTV_INPUT_DOCK_BORDER,
          background: LIBTV_INPUT_DOCK_BG,
          height: dockHeight,
          maxHeight: dockHeight,
          transition: "height 180ms ease",
        }}
      >
        <button
          type="button"
          title={expanded ? "收起输入坞" : "放大输入坞"}
          className="nodrag absolute right-2 top-2 z-20 grid size-7 place-items-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-white/80"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <Minimize2 className="size-3.5" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
        </button>
        {header}
        <div className="pro2-dock-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          {children}
        </div>
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    </div>,
    viewportEl,
  );
}

export function Pro2DockContextBar({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      className={cn(
        "nodrag flex min-h-[44px] shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-2",
        LIBTV_INPUT_DOCK_DIVIDER,
      )}
    >
      {children}
    </div>
  );
}

export function Pro2DockToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "nodrag flex shrink-0 items-center justify-between gap-2 border-t px-2 py-1.5",
        LIBTV_INPUT_DOCK_DIVIDER,
        className,
      )}
    >
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
      className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}
    >
      {header}
      <div className="pro2-dock-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>
      {footer ? <div className="shrink-0">{footer}</div> : null}
    </div>
  );
}
