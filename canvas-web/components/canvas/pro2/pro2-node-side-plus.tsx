"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, useViewport } from "@xyflow/react";
import type { HandleType } from "@xyflow/react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { RF_NO_DRAG } from "@/lib/canvas/react-flow-classes";
import type { Pro2AddMenuSection } from "@/lib/canvas/pro2-add-node-menu";
import { Pro2AddNodePopover } from "./pro2-add-node-popover";

const DRAG_THRESHOLD_PX = 6;
const MENU_OFFSET_X = 208;
const MENU_OFFSET_Y = 8;

function sideMenuAnchorFromRect(
  rect: DOMRect,
  side: "left" | "right",
): { x: number; y: number } {
  return {
    x: side === "left" ? rect.left - MENU_OFFSET_X : rect.right + MENU_OFFSET_Y,
    y: rect.top - MENU_OFFSET_Y,
  };
}

export type Pro2NodeSidePlusProps = {
  side: "left" | "right";
  /** 与节点已有 Handle id 对齐；左侧添加上下文用 `plus_left`（连线方向在 store.onConnect 翻转） */
  handleId: string;
  handleType?: HandleType;
  sections: Pro2AddMenuSection[];
  onPick: (itemId: string, nodeType?: string) => void;
  className?: string;
  visible?: boolean;
};

/**
 * LibTV 侧栏 +：单击 → 下一步菜单；按住拖动 → React Flow 连线（吸附目标节点边框）
 */
export function Pro2NodeSidePlus({
  side,
  handleId,
  handleType = "source",
  sections,
  onPick,
  className,
  visible = true,
}: Pro2NodeSidePlusProps) {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const handleWrapRef = useRef<HTMLDivElement>(null);
  const viewport = useViewport();
  const gestureRef = useRef<{
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);

  const position = side === "left" ? Position.Left : Position.Right;

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, [open, viewport.x, viewport.y, viewport.zoom]);

  const anchor = useMemo(() => {
    if (!open) return { x: 0, y: 0 };
    const handle = handleWrapRef.current?.querySelector(
      ".pro2-node-side-plus-handle",
    ) as HTMLElement | null;
    const rect = handle?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return sideMenuAnchorFromRect(rect, side);
  }, [open, side, viewport.x, viewport.y, viewport.zoom, tick]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    gestureRef.current = { x: e.clientX, y: e.clientY, moved: false };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const g = gestureRef.current;
    if (!g || g.moved) return;
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > DRAG_THRESHOLD_PX) {
      g.moved = true;
    }
  }, []);

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const g = gestureRef.current;
      gestureRef.current = null;
      if (!g || g.moved) return;
      e.stopPropagation();
      setOpen(true);
    },
    [side],
  );

  if (!visible) return null;

  return (
    <>
      <div
        ref={handleWrapRef}
        className={cn(
          "pointer-events-none absolute top-1/2 z-30 -translate-y-1/2",
          side === "left" ? "-left-5" : "-right-5",
          className,
        )}
      >
        <Handle
          id={handleId}
          type={handleType}
          position={position}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          className={cn(
            RF_NO_DRAG,
            "pro2-node-side-plus-handle pointer-events-auto",
            "!flex !h-12 !w-12 !items-center !justify-center !rounded-full !p-0",
            "!border !border-white/20 !bg-[#2a2a2e] !opacity-100",
            "!shadow-md transition hover:!border-violet-400/50 hover:!bg-violet-500/20",
            side === "left" ? "!-left-0" : "!-right-0",
            "!top-1/2 !-translate-y-1/2",
          )}
          title={
            side === "left"
              ? "添加上下文 · 单击菜单 / 拖拽连线"
              : "引用生成 · 单击菜单 / 拖拽连线"
          }
        >
          <Plus
            className="pointer-events-none size-7 shrink-0 text-white/85"
            strokeWidth={2.25}
            aria-hidden
          />
        </Handle>
      </div>
      <Pro2AddNodePopover
        open={open}
        anchor={anchor}
        sections={sections}
        onClose={() => setOpen(false)}
        onPick={onPick}
      />
    </>
  );
}
