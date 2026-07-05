"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Handle,
  Position,
  useNodeId,
  useUpdateNodeInternals,
  useStore,
} from "@xyflow/react";
import type { HandleType } from "@xyflow/react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { RF_NO_DRAG } from "@/lib/canvas/react-flow-classes";
import { libtvSidePlusInHandleId } from "@/lib/canvas/libtv-side-plus-in-handle";
import { LIBTV_NODE_SIDE_PLUS_LAYER_CLASS } from "@/lib/canvas/libtv-node-chrome";
import type { Pro2AddMenuSection } from "@/lib/canvas/pro2-add-node-menu";
import { Pro2AddNodePopover } from "./pro2-add-node-popover";

const DRAG_THRESHOLD_PX = 6;
const MENU_OFFSET_X = 208;
const MENU_OFFSET_Y = 12;
/** 侧 + 水平磁吸：节点外可激活距离（左 + 靠左 / 右 + 靠右） */
const MAGNET_OUTWARD_PX = 40;
/** 侧 + 水平磁吸：节点内可激活距离 */
const MAGNET_INWARD_PX = 28;
/** 沿边跟随 · 距节点顶/底最小留白 */
const MAGNET_VERTICAL_INSET_PX = 24;
/** 相对节点中心最大跟随偏移（flow 坐标） */
const MAGNET_MAX_OFFSET_FLOW_PX = 120;

function sideMenuAnchorFromRect(
  rect: DOMRect,
  side: "left" | "right",
): { x: number; y: number } {
  const cy = rect.top + rect.height / 2;
  return {
    x: side === "left" ? rect.left - MENU_OFFSET_X : rect.right + MENU_OFFSET_Y,
    y: cy - MENU_OFFSET_Y,
  };
}

function pointerNearSideEdge(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  side: "left" | "right",
): boolean {
  if (
    clientY < rect.top + MAGNET_VERTICAL_INSET_PX ||
    clientY > rect.bottom - MAGNET_VERTICAL_INSET_PX
  ) {
    return false;
  }
  if (side === "left") {
    return (
      clientX >= rect.left - MAGNET_OUTWARD_PX &&
      clientX <= rect.left + MAGNET_INWARD_PX
    );
  }
  return (
    clientX >= rect.right - MAGNET_INWARD_PX &&
    clientX <= rect.right + MAGNET_OUTWARD_PX
  );
}

function computeMagnetOffsetFlow(
  clientY: number,
  rect: DOMRect,
  zoom: number,
): number {
  const centerY = rect.top + rect.height / 2;
  const screenDy = clientY - centerY;
  const maxScreen = Math.min(
    rect.height * 0.38,
    MAGNET_MAX_OFFSET_FLOW_PX * Math.max(zoom, 0.05),
  );
  const clampedScreen = Math.max(-maxScreen, Math.min(maxScreen, screenDy));
  return clampedScreen / Math.max(zoom, 0.05);
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
  /** 鼠标靠近时 + 沿边跟随（组 / 有连线时更易点） */
  magneticFollow?: boolean;
  /** 侧 + 按钮尺寸：default · lg（视频节点左右 + 放大一倍） */
  size?: "default" | "lg";
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
  magneticFollow = true,
  size = "lg",
}: Pro2NodeSidePlusProps) {
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const [open, setOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [magnetOffsetY, setMagnetOffsetY] = useState(0);
  const handleWrapRef = useRef<HTMLDivElement>(null);
  const zoom = useStore((s) => s.transform[2]);
  const gestureRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);

  const position = side === "left" ? Position.Left : Position.Right;

  const hostNodeEl = useCallback((): HTMLElement | null => {
    return (
      handleWrapRef.current?.closest(".react-flow__node") ??
      handleWrapRef.current?.closest(".canvas-group-node") ??
      null
    );
  }, []);

  const captureMenuAnchor = useCallback(() => {
    const handle = handleWrapRef.current?.querySelector(
      ".pro2-node-side-plus-handle",
    ) as HTMLElement | null;
    const rect = handle?.getBoundingClientRect();
    if (!rect) return null;
    return sideMenuAnchorFromRect(rect, side);
  }, [side]);

  useLayoutEffect(() => {
    if (!nodeId) return;
    updateNodeInternals(nodeId);
  }, [nodeId, visible, size, magnetOffsetY, updateNodeInternals]);

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || !magneticFollow || open) {
      setMagnetOffsetY(0);
      return;
    }
    const onPointerMove = (e: PointerEvent) => {
      const host = hostNodeEl();
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (!pointerNearSideEdge(e.clientX, e.clientY, rect, side)) {
        setMagnetOffsetY(0);
        return;
      }
      setMagnetOffsetY(computeMagnetOffsetFlow(e.clientY, rect, zoom));
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [visible, magneticFollow, open, side, hostNodeEl, zoom]);

  const openMenu = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      const anchor = captureMenuAnchor();
      if (anchor) setMenuAnchor(anchor);
      setMagnetOffsetY(0);
      setOpen(true);
    },
    [captureMenuAnchor],
  );

  const closeMenu = useCallback(() => {
    setOpen(false);
    setMenuAnchor(null);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    gestureRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId || g.moved) return;
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > DRAG_THRESHOLD_PX) {
      g.moved = true;
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gestureRef.current = null;
    if (g.moved) return;
    openMenu(e);
  }, [openMenu]);

  const wrapStyle: CSSProperties = {
    top: "50%",
    transform: `translateY(calc(-50% + ${magnetOffsetY}px))`,
  };

  const lg = size === "lg";

  return (
    <>
      <div
        ref={handleWrapRef}
        style={wrapStyle}
        className={cn(
          "pro2-node-side-plus-layer pointer-events-none absolute top-1/2 w-0",
          side === "left" ? "left-0" : "right-0",
          LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
          !visible && "pointer-events-none opacity-0",
          className,
        )}
        aria-hidden={!visible}
      >
        {side === "left" || side === "right" ? (
          <Handle
            id={libtvSidePlusInHandleId(handleId)}
            type="target"
            position={position}
            className={cn(
              RF_NO_DRAG,
              "pro2-node-side-plus-handle",
              "pro2-node-side-plus-in-handle",
              lg && "pro2-node-side-plus-handle--lg",
            )}
            title="连接到此节点"
          />
        ) : null}
        <Handle
          id={handleId}
          type={handleType}
          position={position}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={cn(
            RF_NO_DRAG,
            "pro2-node-side-plus-handle",
            lg && "pro2-node-side-plus-handle--lg",
            "!flex !items-center !justify-center !rounded-full !border !border-white/25 !bg-[#2a2a2e] !p-0 !opacity-100",
            "!shadow-[0_4px_16px_rgba(0,0,0,0.45)]",
            visible &&
              "hover:!border-violet-400/60 hover:!bg-violet-500/25",
            !visible && "!pointer-events-none !opacity-0",
          )}
          title={
            side === "left"
              ? "添加上下文 · 单击菜单 / 拖拽连线"
              : "引用生成 · 单击菜单 / 拖拽连线"
          }
        >
          <Plus
            className={cn(
              "pointer-events-none shrink-0 text-white/90",
              lg ? "size-12" : "size-6",
            )}
            strokeWidth={2.25}
            aria-hidden
          />
        </Handle>
      </div>
      <Pro2AddNodePopover
        open={open && visible}
        anchor={menuAnchor ?? { x: 0, y: 0 }}
        sections={sections}
        onClose={closeMenu}
        onPick={(itemId, nodeType) => {
          closeMenu();
          onPick(itemId, nodeType);
        }}
      />
    </>
  );
}
