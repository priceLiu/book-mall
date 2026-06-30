"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReactFlow } from "@xyflow/react";
import { Download, Plus } from "lucide-react";

import { useClientPortalMounted } from "@/lib/canvas/use-modal-portal-effects";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import { findBatchConnectSnapTarget } from "@/lib/canvas/libtv-connection-snap";
import {
  buildBatchConnectEdges,
  nodeBatchOutHandle,
  nodesEligibleForBatchOut,
  pickBatchTargetHandle,
} from "@/lib/canvas/pro2-batch-connect";
import { batchConnectSelectionClientBox } from "@/lib/canvas/batch-connect-preview-anchors";
import {
  computePro2MultiSelectionBbox,
  pro2SelectedNonGroupIds,
} from "@/lib/canvas/pro2-selection-bbox";
import { useCanvasStore } from "@/lib/canvas/store";
import { NODE_DEFAULT_SIZE, type CanvasFlowNode } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";
import { BatchConnectPreviewLines } from "./batch-connect-preview-lines";
import { BatchConnectSpawnMenu } from "./batch-connect-spawn-menu";

const DRAG_THRESHOLD = 3;

const SPAWN_MENU_OFFSET_X = 12;

function Pro2SelectionBatchConnectLayerInner({
  rfNodes,
}: {
  rfNodes: CanvasFlowNode[];
}) {
  const { flowToScreenPosition, screenToFlowPosition, getInternalNode } =
    useReactFlow();
  const viewportMoving = useCanvasStore((s) => s.canvasViewportMoving);
  const storeNodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const setConnectingFrom = useCanvasStore((s) => s.setConnectingFrom);

  const selectedIds = useMemo(
    () => pro2SelectedNonGroupIds(rfNodes),
    [rfNodes],
  );

  const viewport = useViewportTransformActive(
    selectedIds.length >= 2 && !viewportMoving,
  );

  const bbox = useMemo(() => {
    const pool = rfNodes.length ? rfNodes : storeNodes;
    return computePro2MultiSelectionBbox(
      selectedIds,
      pool as CanvasFlowNode[],
      getInternalNode,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, getInternalNode, rfNodes, storeNodes, viewport]);

  const eligibleSources = useMemo(
    () => nodesEligibleForBatchOut(storeNodes, selectedIds),
    [storeNodes, selectedIds],
  );

  const clientBox = useMemo(() => {
    void viewport;
    return batchConnectSelectionClientBox(selectedIds);
  }, [selectedIds, viewport]);

  const flowScreenBox = useMemo(() => {
    if (!bbox) return null;
    const tl = flowToScreenPosition({ x: bbox.x, y: bbox.y });
    const br = flowToScreenPosition({ x: bbox.x2, y: bbox.y2 });
    return {
      left: tl.x,
      top: tl.y,
      width: br.x - tl.x,
      height: br.y - tl.y,
      right: br.x,
      midY: (tl.y + br.y) / 2,
    };
  }, [bbox, flowToScreenPosition, viewport]);

  const screenBox = clientBox ?? flowScreenBox;

  const [dragging, setDragging] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  /** 预览线终点：拖拽跟指针，菜单打开后吸附菜单左缘中点 */
  const [lineTarget, setLineTarget] = useState<{ x: number; y: number } | null>(
    null,
  );
  const gestureRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const pointerCleanupRef = useRef<(() => void) | null>(null);
  const menuOpenRef = useRef(false);

  const connectBatchToTarget = useCallback(
    (targetId: string, targetHandle?: string) => {
      if (eligibleSources.length < 2) return;
      const { nodes: latestNodes, edges: latestEdges } =
        useCanvasStore.getState();
      const batchEdges = buildBatchConnectEdges(
        eligibleSources,
        targetId,
        latestNodes,
        latestEdges,
        targetHandle,
      );
      if (!batchEdges.length) return;
      setEdges((prev) => [...prev, ...batchEdges]);
    },
    [eligibleSources, setEdges],
  );

  const clearPreview = useCallback(() => {
    pointerCleanupRef.current?.();
    pointerCleanupRef.current = null;
    setDragging(false);
    setMenuAnchor(null);
    menuOpenRef.current = false;
    setLineTarget(null);
    setConnectingFrom(null);
    gestureRef.current = null;
  }, [setConnectingFrom]);

  const spawnExportAndConnect = useCallback(
    (anchor: { x: number; y: number }) => {
      if (eligibleSources.length < 2) return;
      const { height } = NODE_DEFAULT_SIZE["jianying-export-pro2"];
      const flow = screenToFlowPosition({ x: anchor.x, y: anchor.y });
      const newId = addNode(
        "jianying-export-pro2",
        {
          x: flow.x + SPAWN_MENU_OFFSET_X,
          y: flow.y - height / 2,
        },
        { label: "导出剪辑" },
      );
      if (!newId) return;
      connectBatchToTarget(newId, "in_video");
      clearPreview();
      setNodes((prev) =>
        prev.map((n) => ({ ...n, selected: n.id === newId })),
      );
    },
    [
      eligibleSources.length,
      screenToFlowPosition,
      addNode,
      connectBatchToTarget,
      clearPreview,
      setNodes,
    ],
  );

  const closeMenu = useCallback(() => {
    menuOpenRef.current = false;
    setMenuAnchor(null);
    setLineTarget(null);
    setConnectingFrom(null);
  }, [setConnectingFrom]);

  const finishDrag = useCallback(
    (clientX: number, clientY: number) => {
      pointerCleanupRef.current?.();
      pointerCleanupRef.current = null;
      setDragging(false);
      gestureRef.current = null;

      const flowPoint = screenToFlowPosition({ x: clientX, y: clientY });
      const target = findBatchConnectSnapTarget(
        storeNodes,
        flowPoint,
        selectedIds,
      );

      if (target && !selectedIds.includes(target.id)) {
        if (target.type === "jianying-export-pro2") {
          connectBatchToTarget(target.id, "in_video");
        } else {
          const sample = eligibleSources[0];
          const outHandle = sample ? nodeBatchOutHandle(sample) : null;
          const sampleHandle =
            sample && outHandle
              ? pickBatchTargetHandle(target, sample, outHandle)
              : null;
          if (sampleHandle) {
            connectBatchToTarget(target.id, sampleHandle);
          }
        }
        clearPreview();
        return;
      }

      menuOpenRef.current = true;
      setMenuAnchor({ x: clientX, y: clientY });
      setLineTarget({ x: clientX, y: clientY });
      setConnectingFrom(eligibleSources[0]?.id ?? null);
    },
    [
      screenToFlowPosition,
      storeNodes,
      selectedIds,
      eligibleSources,
      connectBatchToTarget,
      clearPreview,
      setConnectingFrom,
    ],
  );

  useEffect(() => {
    if (!dragging) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "crosshair";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging]);

  useEffect(() => () => pointerCleanupRef.current?.(), []);

  const onPlusPointerDown = (e: React.PointerEvent) => {
    if (eligibleSources.length < 2) return;
    e.preventDefault();
    e.stopPropagation();

    pointerCleanupRef.current?.();
    closeMenu();

    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;

    gestureRef.current = {
      pointerId,
      x: startX,
      y: startY,
      moved: false,
    };
    setConnectingFrom(eligibleSources[0]?.id ?? null);
    setDragging(true);
    setLineTarget({ x: startX, y: startY });

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      setLineTarget({ x: ev.clientX, y: ev.clientY });
      const g = gestureRef.current;
      if (!g) return;
      if (
        !g.moved &&
        (Math.abs(ev.clientX - g.x) > DRAG_THRESHOLD ||
          Math.abs(ev.clientY - g.y) > DRAG_THRESHOLD)
      ) {
        g.moved = true;
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      pointerCleanupRef.current?.();
      pointerCleanupRef.current = null;
      const moved = gestureRef.current?.moved ?? false;
      if (moved) {
        finishDrag(ev.clientX, ev.clientY);
      } else {
        setDragging(false);
        gestureRef.current = null;
        menuOpenRef.current = true;
        setMenuAnchor({ x: ev.clientX, y: ev.clientY });
        setLineTarget({ x: ev.clientX, y: ev.clientY });
        setConnectingFrom(eligibleSources[0]?.id ?? null);
      }
    };

    window.addEventListener("pointermove", onMove, { capture: true });
    window.addEventListener("pointerup", onUp, { capture: true });
    window.addEventListener("pointercancel", onUp, { capture: true });

    pointerCleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
    };
  };

  if (
    viewportMoving ||
    selectedIds.length < 2 ||
    eligibleSources.length < 2 ||
    !screenBox
  ) {
    return null;
  }

  const boxLeft = screenBox.left;
  const boxTop = screenBox.top;
  const boxWidth =
    "right" in screenBox
      ? screenBox.right - screenBox.left
      : screenBox.width;
  const boxHeight =
    "bottom" in screenBox
      ? screenBox.bottom - screenBox.top
      : screenBox.height;
  const plusLeft = screenBox.right + 4;
  const plusTop = screenBox.midY;

  const showPreviewLines =
    lineTarget && (dragging || menuAnchor) && eligibleSources.length >= 2;

  return (
    <>
      <div
        className="pointer-events-none fixed z-[2090] rounded-sm border border-dashed border-white/40"
        style={{
          left: boxLeft,
          top: boxTop,
          width: boxWidth,
          height: boxHeight,
        }}
        aria-hidden
      />

      {showPreviewLines ? (
        <BatchConnectPreviewLines
          sources={eligibleSources}
          allNodes={storeNodes}
          cursor={lineTarget}
          flowToScreenPosition={flowToScreenPosition}
          getInternalNode={getInternalNode}
        />
      ) : null}

      <button
        type="button"
        className={cn(
          "pointer-events-auto fixed z-[2110] flex size-11 items-center justify-center rounded-full",
          "border border-white/25 bg-[#2a2a2e] shadow-[0_4px_16px_rgba(0,0,0,0.45)]",
          "hover:border-violet-400/60 hover:bg-violet-500/25",
          dragging && "border-violet-400/60 bg-violet-500/25",
        )}
        style={{
          left: plusLeft,
          top: plusTop,
          transform: "translateY(-50%)",
        }}
        title="批量连线 · 单击菜单 / 拖拽到导出剪辑"
        onPointerDown={onPlusPointerDown}
      >
        <Plus className="size-6 text-white/90" strokeWidth={2.25} />
      </button>

      {menuAnchor ? (
        <BatchConnectSpawnMenu
          anchor={menuAnchor}
          title={`为所选中的 ${eligibleSources.length} 个节点生成`}
          item={{
            id: "export",
            label: "导出剪辑",
            icon: Download,
            nodeType: "jianying-export-pro2",
          }}
          onPick={() => {
            if (menuAnchor) spawnExportAndConnect(menuAnchor);
          }}
          onClose={closeMenu}
          onMenuRect={(pt) => {
            if (menuOpenRef.current) setLineTarget(pt);
          }}
        />
      ) : null}
    </>
  );
}

/** 框选批量连线 UI · portal 到 body，避免被 React Flow viewport transform 裁剪/坐标错乱 */
export function Pro2SelectionBatchConnectLayer({
  rfNodes,
}: {
  rfNodes: CanvasFlowNode[];
}) {
  const mounted = useClientPortalMounted();
  if (!mounted) return null;
  return createPortal(
    <Pro2SelectionBatchConnectLayerInner rfNodes={rfNodes} />,
    document.body,
  );
}
