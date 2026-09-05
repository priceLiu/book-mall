"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useViewport } from "@xyflow/react";

/** Dock 下拉基准层级 · 画布内默认 1600；嵌在全屏弹层里须由宿主抬高 */
const TOOLBAR_DROPDOWN_BASE_Z = 1600;

const ToolbarDropdownZContext = createContext(TOOLBAR_DROPDOWN_BASE_Z);

/** 在全屏弹层内复用 Dock 模型/参数下拉时包一层，避免下拉落到弹层背后 */
export function LibtvToolbarDropdownZProvider({
  zIndex,
  children,
}: {
  zIndex: number;
  children: ReactNode;
}) {
  return (
    <ToolbarDropdownZContext.Provider value={zIndex}>
      {children}
    </ToolbarDropdownZContext.Provider>
  );
}

export function useSbv1ToolbarAnchor(isOpen?: boolean): {
  anchorRef: RefObject<HTMLButtonElement>;
  open: boolean;
  setOpen: (v: boolean) => void;
  rect: DOMRect | null;
} {
  const anchorRef = useRef<HTMLButtonElement>(null!);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = isOpen !== undefined;
  const effectiveOpen = isControlled ? isOpen : internalOpen;
  const viewport = useViewport();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!effectiveOpen) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, [effectiveOpen, viewport.x, viewport.y, viewport.zoom]);

  const rect = useMemo(() => {
    if (!effectiveOpen) return null;
    return anchorRef.current?.getBoundingClientRect() ?? null;
  }, [effectiveOpen, tick, viewport.x, viewport.y, viewport.zoom]);

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
  };

  return { anchorRef, open: effectiveOpen, setOpen, rect };
}

export type Sbv1ToolbarDropdownPlacement = "auto" | "above" | "below";

function resolveToolbarDropdownSide(
  rect: DOMRect,
  placement: Sbv1ToolbarDropdownPlacement,
  estimatedHeight: number,
): "above" | "below" {
  if (placement === "above") return "above";
  if (placement === "below") return "below";
  const gap = 6;
  const spaceAbove = rect.top - gap;
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  if (spaceBelow >= estimatedHeight) return "below";
  if (spaceAbove >= estimatedHeight) return "above";
  return spaceBelow >= spaceAbove ? "below" : "above";
}

export function Sbv1ToolbarDropdown({
  open,
  setOpen,
  rect,
  children,
  className,
  align = "start",
  placement = "auto",
  estimatedHeight = 320,
  /** 子组件自管滚动（如音色列表）时关闭面板外层滚动，避免双滚动抢 wheel */
  containScroll = false,
  /** 与 maxHeight 同高，供内部 flex 列表占满剩余空间 */
  fillHeight = false,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  rect: DOMRect | null;
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  placement?: Sbv1ToolbarDropdownPlacement;
  /** auto 时用于判断向上/向下展开 */
  estimatedHeight?: number;
  containScroll?: boolean;
  fillHeight?: boolean;
}) {
  const baseZ = useContext(ToolbarDropdownZContext);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;

  /**
   * 用监听代替全屏遮罩：遮罩会吃掉「关闭下拉」的那一次点击，
   * 导致选完模型后还要再点一次节点才选中（节点顶栏看起来出不来）。
   */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && panelRef.current?.contains(target)) return;
      // 锚点自身的 toggle 交给按钮 onClick，避免关了又立刻开
      if (
        rect &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        return;
      }
      setOpenRef.current(false);
    };
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () =>
      window.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      });
  }, [open, rect]);

  if (!open || !rect || typeof document === "undefined") return null;

  const gap = 6;
  const spaceAbove = rect.top - gap;
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const side = resolveToolbarDropdownSide(rect, placement, estimatedHeight);
  const available = side === "above" ? spaceAbove : spaceBelow;
  const panelMaxHeight = Math.max(160, Math.min(estimatedHeight, available));
  const left =
    align === "center"
      ? rect.left + rect.width / 2
      : align === "end"
        ? rect.right
        : rect.left;
  const top = side === "above" ? rect.top - gap : rect.bottom + gap;
  const transform =
    side === "above"
      ? align === "center"
        ? "translate(-50%, -100%)"
        : align === "end"
          ? "translate(-100%, -100%)"
          : "translateY(-100%)"
      : align === "center"
        ? "translate(-50%, 0)"
        : align === "end"
          ? "translate(-100%, 0)"
          : undefined;

  return createPortal(
    <div
      ref={panelRef}
      className={className}
      style={{
        position: "fixed",
        left,
        top,
        transform,
        zIndex: baseZ + 1,
        maxHeight: panelMaxHeight,
        height: fillHeight ? panelMaxHeight : undefined,
        overflowY: containScroll ? "hidden" : "auto",
        display: fillHeight ? "flex" : undefined,
        flexDirection: fillHeight ? "column" : undefined,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
