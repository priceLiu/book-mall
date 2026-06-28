"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@xyflow/react";
import { Maximize2, Minimize2 } from "lucide-react";
import { LibtvInputDockUiContext } from "@/lib/canvas/libtv-input-dock-ui-context";
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
  PRO2_DOCK_WIDTH,
  PRO2_DOCK_WIDTH_EXPANDED,
} from "@/lib/canvas/story-pro2-node-chrome";
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
  /** 默认 flowAnchor.flowW */
  width?: number;
  /** 拖动所属节点时隐藏（仍挂载 · 保持锚点与输入状态） */
  hidden?: boolean;
};

/**
 * 反向缩放钳制：在常用缩放区间内坞保持恒定屏幕尺寸；超出区间（极端放大/缩小）
 * 时不再完全补偿，避免坞缩成过小或撑成铺满屏幕。
 */
const DOCK_INVERSE_SCALE_MIN = 0.45;
const DOCK_INVERSE_SCALE_MAX = 2.2;
/** 画布缩小（zoom<1）时坞在恒定尺寸基础上最多额外放大 30% */
const DOCK_ZOOM_OUT_MAX_BOOST = 1.3;
/** 缩放到该值时达到满额 +30%（区间内线性渐入） */
const DOCK_ZOOM_OUT_BOOST_FULL = 0.5;

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
  const [dockScrollEl, setDockScrollEl] = useState<HTMLElement | null>(null);
  useLibtvDockWheelScroll(dockScrollEl);
  // 画布缩放：坞挂在 viewport 内会随之 scale(zoom)，这里反向 1/zoom 抵消，
  // 让坞在屏幕上保持恒定尺寸（仅影响坞自身视觉，不碰画布缩放上下限）。
  const zoom = useStore((s) => s.transform[2]);
  const baseInv = 1 / (zoom || 1);
  // 画布缩小时按缩放程度线性放大，最多 +30%；放大画布时不加成（仍保持恒定）
  const zoomOutBoost =
    zoom >= 1
      ? 1
      : 1 +
        (DOCK_ZOOM_OUT_MAX_BOOST - 1) *
          Math.min(1, (1 - zoom) / (1 - DOCK_ZOOM_OUT_BOOST_FULL));
  const invScale = Math.min(
    DOCK_INVERSE_SCALE_MAX * DOCK_ZOOM_OUT_MAX_BOOST,
    Math.max(DOCK_INVERSE_SCALE_MIN, baseInv * zoomOutBoost),
  );
  const baseDockW = width ?? flowAnchor.flowW;
  // 放大态：长（宽）与高同时展开，宽边按更大比例放大，视觉更明显
  const dockW = expanded
    ? Math.round(baseDockW * (PRO2_DOCK_WIDTH_EXPANDED / PRO2_DOCK_WIDTH))
    : Math.round(baseDockW);
  const baseDockH = flowAnchor.flowH ?? PRO2_DOCK_HEIGHT;
  const dockHeight = expanded
    ? Math.round(baseDockH * (PRO2_DOCK_HEIGHT_EXPANDED / PRO2_DOCK_HEIGHT))
    : Math.round(baseDockH);
  const dockUi = useMemo(() => ({ expanded }), [expanded]);

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
          transition: "width 180ms ease",
          // origin=顶部中点；先 scale 再 translateX(-50%)，使坞顶部中点恒定锚在 (flowX,flowY)
          transformOrigin: "50% 0",
          transform: `translateX(-50%) scale(${invScale}) translateZ(0)`,
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
          <div
            ref={setDockScrollEl}
            className="pro2-dock-scroll flex h-0 min-h-0 flex-1 flex-col overflow-hidden overscroll-contain [overflow-anchor:none]"
            data-canvas-wheel-scroll
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
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

/** Dock 顶栏：上行参考缩略图 · 下行操作按钮（标记 / 风格 / 上传等） */
export function Pro2DockHeader({
  refRow,
  actionRow,
}: {
  refRow?: ReactNode;
  actionRow?: ReactNode;
}) {
  if (!refRow && !actionRow) return null;
  return (
    <div
      className={cn("nodrag shrink-0 border-b", LIBTV_INPUT_DOCK_DIVIDER)}
    >
      {refRow ? (
        <div className="hide-scroll-bar flex min-h-[44px] min-w-0 items-center gap-1.5 overflow-x-auto border-b border-white/[0.06] px-3 py-1">
          {refRow}
        </div>
      ) : null}
      {actionRow ? (
        <div className="flex min-h-[40px] flex-wrap items-center gap-1.5 px-3 py-1.5">
          {actionRow}
        </div>
      ) : null}
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
