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
  useStoreApi,
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
import { useCanvasStore } from "@/lib/canvas/store";
import { useCanvasMarqueeSelecting } from "@/lib/canvas/use-canvas-marquee-selecting";
import { Pro2AddNodePopover } from "./pro2-add-node-popover";

const DRAG_THRESHOLD_PX = 6;
const MENU_OFFSET_X = 208;
const MENU_OFFSET_Y = 12;
/** 鼠标距节点左右边框 ≤ 此值时 + 吸附并跟随指针（px · 屏幕坐标） */
const MAGNET_ACTIVATE_PX = 100;
/** 释放磁吸略宽于激活，避免边界抖动 */
const MAGNET_RELEASE_PX = 112;
/** 节点内侧 · 仅贴边此宽度内算「边框带」，更深内部不吸附 */
const MAGNET_BORDER_INWARD_PX = 8;
/** 沿边/离边跟随 · 相对节点边框最大偏移（px · 屏幕坐标，再换算 flow） */
const MAGNET_MAX_OFFSET_SCREEN_PX = 100;
/** 沿边跟随 · 相对节点中心最大纵向偏移（flow 坐标） */
const MAGNET_MAX_OFFSET_FLOW_PX = 160;

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
  thresholdPx: number,
): boolean {
  const inVerticalBand =
    clientY >= rect.top - thresholdPx && clientY <= rect.bottom + thresholdPx;
  if (!inVerticalBand) return false;
  if (side === "left") {
    if (clientX >= rect.left - thresholdPx && clientX < rect.left) return true;
    return (
      clientX >= rect.left &&
      clientX <= rect.left + MAGNET_BORDER_INWARD_PX
    );
  }
  if (clientX > rect.right && clientX <= rect.right + thresholdPx) return true;
  return (
    clientX >= rect.right - MAGNET_BORDER_INWARD_PX &&
    clientX <= rect.right
  );
}

function computeMagnetOffsetFlow(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  side: "left" | "right",
  zoom: number,
): { x: number; y: number } {
  const z = Math.max(zoom, 0.05);
  const centerY = rect.top + rect.height / 2;
  const maxScreenY = Math.min(
    rect.height * 0.46,
    MAGNET_MAX_OFFSET_FLOW_PX * z,
  );
  const screenDy = Math.max(-maxScreenY, Math.min(maxScreenY, clientY - centerY));

  /** 相对节点左/右边框：正 = 进入节点内侧，负 = 伸出节点外侧 */
  const rawScreenX =
    side === "left" ? clientX - rect.left : rect.right - clientX;
  const screenDx = Math.max(
    -MAGNET_MAX_OFFSET_SCREEN_PX,
    Math.min(MAGNET_MAX_OFFSET_SCREEN_PX, rawScreenX),
  );

  return { x: screenDx / z, y: screenDy / z };
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
  const rfStore = useStoreApi();
  const [open, setOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [magnetOffset, setMagnetOffset] = useState({ x: 0, y: 0 });
  const handleWrapRef = useRef<HTMLDivElement>(null);
  const magnetActiveRef = useRef(false);
  const zoom = useStore((s) => s.transform[2]);
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);
  const connectingFromHandleId = useCanvasStore(
    (s) => s.connectingFromHandleId,
  );
  /** 仅当拖线来自「其它」节点时才挂入边吸附层：
   * 否则从本节点 + 拖出后原地松手会落在自己的吸附层上，生成一条自连边
   * （边绕到节点背后被遮住，只在左右两侧各露出一小截白线）。 */
  const canvasConnecting = Boolean(
    connectingFromNodeId && connectingFromNodeId !== nodeId,
  );
  const marqueeSelecting = useCanvasMarqueeSelecting();
  const multiSelectActive = useCanvasStore((s) => s.canvasMultiSelectActive);
  /** 框选中 / 多选选区存在时，连线交给选区批量 +（Pro2SelectionBatchConnectLayer） */
  const selectionOwnsPlus = marqueeSelecting || multiSelectActive;
  /** 拖线期间只保留正在拖的那一个 +：其余节点与本节点另一侧全部隐藏 */
  const dotVisible = connectingFromNodeId
    ? connectingFromNodeId === nodeId && connectingFromHandleId === handleId
    : visible && !selectionOwnsPlus;
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
    const dot = handleWrapRef.current?.querySelector(
      ".pro2-node-side-plus-dot",
    ) as HTMLElement | null;
    const rect = dot?.getBoundingClientRect();
    if (!rect) return null;
    return sideMenuAnchorFromRect(rect, side);
  }, [side]);

  /** 磁吸只移动可见圆点，handle 锚点恒在边框上，故不随 magnetOffset 重测 */
  useLayoutEffect(() => {
    if (!nodeId) return;
    updateNodeInternals(nodeId);
  }, [nodeId, visible, size, canvasConnecting, updateNodeInternals]);

  useEffect(() => {
    if (!dotVisible) setOpen(false);
  }, [dotVisible]);

  useEffect(() => {
    // 拖线期间 + 不再跟随指针，避免与连线预览抢视线
    if (!dotVisible || connectingFromNodeId || !magneticFollow || open) {
      magnetActiveRef.current = false;
      setMagnetOffset({ x: 0, y: 0 });
      return;
    }
    const onPointerMove = (e: PointerEvent) => {
      const host = hostNodeEl();
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const activate = pointerNearSideEdge(
        e.clientX,
        e.clientY,
        rect,
        side,
        MAGNET_ACTIVATE_PX,
      );
      const release = pointerNearSideEdge(
        e.clientX,
        e.clientY,
        rect,
        side,
        MAGNET_RELEASE_PX,
      );
      if (magnetActiveRef.current) {
        if (!release) {
          magnetActiveRef.current = false;
          setMagnetOffset({ x: 0, y: 0 });
          return;
        }
        setMagnetOffset(
          computeMagnetOffsetFlow(e.clientX, e.clientY, rect, side, zoom),
        );
        return;
      }
      if (!activate) {
        setMagnetOffset({ x: 0, y: 0 });
        return;
      }
      magnetActiveRef.current = true;
      setMagnetOffset(
        computeMagnetOffsetFlow(e.clientX, e.clientY, rect, side, zoom),
      );
    };
    const onPointerUp = () => {
      magnetActiveRef.current = false;
      setMagnetOffset({ x: 0, y: 0 });
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [
    dotVisible,
    connectingFromNodeId,
    magneticFollow,
    open,
    side,
    hostNodeEl,
    zoom,
  ]);

  const openMenu = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      rfStore.setState({
        userSelectionActive: false,
        userSelectionRect: null,
      });
      useCanvasStore.getState().setCanvasMarqueeSelecting(false);
      const anchor = captureMenuAnchor();
      if (anchor) setMenuAnchor(anchor);
      setMagnetOffset({ x: 0, y: 0 });
      setOpen(true);
    },
    [captureMenuAnchor, rfStore],
  );

  const closeMenu = useCallback(() => {
    setOpen(false);
    setMenuAnchor(null);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    gestureRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId || g.moved) return;
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > DRAG_THRESHOLD_PX) {
      g.moved = true;
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gestureRef.current = null;
    if (g.moved) return;
    openMenu(e);
  }, [openMenu]);

  /** wrap 为 0×0 锚点，原点恒定落在节点左/右边框中点（连线由此出入，勿随磁吸移动） */
  const wrapStyle: CSSProperties = { top: "50%" };

  /** 磁吸只平移可见圆点：圆与 + 图标一起动，连线锚点不动 */
  const dotStyle: CSSProperties = {
    transform: `translate(calc(-50% + ${
      side === "left" ? magnetOffset.x : -magnetOffset.x
    }px), calc(-50% + ${magnetOffset.y}px))`,
  };

  const lg = size === "lg";

  return (
    <>
      <div
        ref={handleWrapRef}
        style={wrapStyle}
        className={cn(
          "pro2-node-side-plus-layer pointer-events-none absolute h-0 w-0",
          side === "left" ? "left-0" : "right-0",
          LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
          !dotVisible && "pointer-events-none opacity-0",
          className,
        )}
        aria-hidden={!dotVisible}
      >
        {canvasConnecting && (side === "left" || side === "right") ? (
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
            "nopan nokey pro2-node-side-plus-handle",
            lg && "pro2-node-side-plus-handle--lg",
          )}
          title={
            side === "left"
              ? "添加上下文 · 单击菜单 / 拖拽连线"
              : "引用生成 · 单击菜单 / 拖拽连线"
          }
        >
          <span
            style={dotStyle}
            className={cn(
              "pro2-node-side-plus-dot",
              lg && "pro2-node-side-plus-dot--lg",
              "flex items-center justify-center rounded-full border border-white/25 bg-[#2a2a2e]",
              "shadow-[0_4px_16px_rgba(0,0,0,0.45)]",
              dotVisible && "hover:border-violet-400/60 hover:bg-violet-500/25",
              !dotVisible && "!pointer-events-none !opacity-0",
            )}
          >
            <Plus
              className={cn(
                "pointer-events-none shrink-0 text-white/90",
                lg ? "size-10" : "size-6",
              )}
              strokeWidth={2.25}
              aria-hidden
            />
          </span>
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
