"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@xyflow/react";
import { Maximize2, Minimize2 } from "lucide-react";
import { LibtvInputDockUiContext } from "@/lib/canvas/libtv-input-dock-ui-context";
import type { LibtvDockFlowPlacement } from "@/lib/canvas/libtv-dock-flow-placement";
import {
  computeLibtvDockInverseScale,
  libtvDockFlowSize,
  libtvDockInnerContentZoom,
  libtvDockPromptFlowFontPx,
  libtvDockPromptFontScreenMetrics,
} from "@/lib/canvas/libtv-dock-scale";
import {
  LIBTV_INPUT_DOCK_BG,
  LIBTV_INPUT_DOCK_BORDER,
  LIBTV_INPUT_DOCK_DIVIDER,
  LIBTV_INPUT_DOCK_SHELL_CLASS,
} from "@/lib/canvas/libtv-node-chrome";
import { useLibtvDockWheelScroll } from "@/lib/canvas/use-libtv-dock-wheel-scroll";
import { RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
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
  /** @deprecated 坞宽统一 16:6 固定 flow 尺寸，忽略 */
  width?: number;
  /** 拖动所属节点时隐藏（仍挂载 · 保持锚点与输入状态） */
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
  hidden = false,
}: Pro2InputDockShellProps) {
  const viewportEl = useReactFlowViewportEl();
  const [expanded, setExpanded] = useState(false);
  const [dockScrollEl, setDockScrollEl] = useState<HTMLElement | null>(null);
  useLibtvDockWheelScroll(dockScrollEl);
  const zoom = useStore((s) => s.transform[2]);
  const { w: dockW, h: dockHeight } = libtvDockFlowSize();
  const invScale = computeLibtvDockInverseScale(zoom, dockW, expanded);
  const contentZoom = libtvDockInnerContentZoom(zoom, expanded);
  const shellScreenScale = invScale * zoom;
  const promptFontFlowPx = libtvDockPromptFlowFontPx(
    libtvDockPromptFontScreenMetrics(zoom),
    shellScreenScale,
    contentZoom,
  );
  const dockUi = useMemo(
    () => ({ expanded, contentZoom, shellScreenScale, canvasZoom: zoom }),
    [expanded, contentZoom, shellScreenScale, zoom],
  );

  if (!viewportEl) return null;

  return createPortal(
    <LibtvInputDockUiContext.Provider value={dockUi}>
      <div
        className={cn(
          "pro2-input-dock pointer-events-auto absolute z-[1000]",
          RF_NO_WHEEL,
          dockClassName,
        )}
        style={{
          left: flowAnchor.flowX,
          top: flowAnchor.flowY,
          width: dockW,
          // origin=顶部中点；先 scale 再 translateX(-50%)，使坞顶部中点恒定锚在 (flowX,flowY)
          transformOrigin: "50% 0",
          transform: `translateX(-50%) scale(${invScale}) translateZ(0)`,
          transition: "transform 180ms ease",
          visibility: hidden ? "hidden" : "visible",
          pointerEvents: hidden ? "none" : "auto",
          backfaceVisibility: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            LIBTV_INPUT_DOCK_SHELL_CLASS,
            RF_NO_WHEEL,
            "relative",
            className,
          )}
          data-libtv-input-dock=""
          data-libtv-dock-expanded={expanded ? "true" : "false"}
          style={{
            borderColor: LIBTV_INPUT_DOCK_BORDER,
            background: LIBTV_INPUT_DOCK_BG,
            height: dockHeight,
            maxHeight: dockHeight,
            display: "flex",
            flexDirection: "column",
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
          <div
            className="libtv-dock-content-zoom flex min-h-0 flex-1 flex-col overflow-hidden"
            style={{
              ...(contentZoom === 1 ? {} : { zoom: contentZoom }),
              ["--libtv-dock-prompt-font" as string]: `${promptFontFlowPx}px`,
            }}
          >
            <div
              ref={setDockScrollEl}
              className="pro2-dock-scroll flex h-0 min-h-0 flex-1 flex-col overflow-hidden overscroll-contain [overflow-anchor:none]"
              data-canvas-wheel-scroll
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {children}
              </div>
            </div>
          </div>
          {footer ? <div className="shrink-0">{footer}</div> : null}
        </div>
      </div>
    </LibtvInputDockUiContext.Provider>,
    viewportEl,
  );
}

export function Pro2DockContextBar({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      className={cn(
        "nodrag flex min-h-[40px] shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-1.5",
        LIBTV_INPUT_DOCK_DIVIDER,
      )}
    >
      {children}
    </div>
  );
}

/** Dock 顶栏：参考缩略图 + 风格 / 标记 / 上传等 · 单行横向排列 */
export function Pro2DockHeader({
  refRow,
  actionRow,
  compact,
  minHeightPx,
}: {
  refRow?: ReactNode;
  actionRow?: ReactNode;
  /** 视频 Dock 等 · 更矮顶栏 */
  compact?: boolean;
  minHeightPx?: number;
}) {
  if (!refRow && !actionRow) return null;
  return (
    <div
      className={cn("nodrag shrink-0 border-b", LIBTV_INPUT_DOCK_DIVIDER)}
    >
      <div
        className={cn(
          "hide-scroll-bar flex min-w-0 flex-nowrap items-center overflow-x-auto",
          compact
            ? "gap-1 px-2 py-1"
            : "min-h-[44px] gap-1.5 px-3 py-1.5",
        )}
        style={
          minHeightPx != null
            ? { minHeight: minHeightPx }
            : compact
              ? { minHeight: 30 }
              : undefined
        }
      >
        {refRow}
        {actionRow}
      </div>
    </div>
  );
}

/** 仅参考缩略图行（视频 Dock 等无第二行操作时） */
export function Pro2DockRefRow({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      className={cn(
        "nodrag flex min-h-[44px] shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-1",
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
  compact,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "nodrag flex shrink-0 items-center justify-between gap-2 border-t",
        LIBTV_INPUT_DOCK_DIVIDER,
        compact ? "px-2 py-1" : "px-2 py-1.5",
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
  const [dockScrollEl, setDockScrollEl] = useState<HTMLElement | null>(null);
  useLibtvDockWheelScroll(dockScrollEl);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        RF_NO_WHEEL,
        className,
      )}
      data-libtv-input-dock=""
    >
      {header}
      <div
        ref={setDockScrollEl}
        className="pro2-dock-scroll flex h-0 min-h-0 flex-1 flex-col overflow-hidden [overflow-anchor:none]"
        data-canvas-wheel-scroll
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
      {footer ? <div className="shrink-0">{footer}</div> : null}
    </div>
  );
}
