"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReactFlow } from "@xyflow/react";
import { Download, Plus, Sparkles, Video } from "lucide-react";

import { useClientPortalMounted } from "@/lib/canvas/use-modal-portal-effects";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import { findBatchConnectSnapTarget } from "@/lib/canvas/libtv-connection-snap";
import {
  batchConnectTargetHandleForSnap,
  batchImageSpawnNodeType,
  buildBatchConnectEdges,
  classifyBatchConnectMode,
  nodesEligibleForBatchOut,
  type BatchConnectMode,
} from "@/lib/canvas/pro2-batch-connect";
import { batchConnectSelectionClientBox } from "@/lib/canvas/batch-connect-preview-anchors";
import {
  computePro2MultiSelectionBbox,
  pro2SelectedNonGroupIds,
} from "@/lib/canvas/pro2-selection-bbox";
import { buildPro2ImageNodeData } from "@/lib/canvas/pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "@/lib/canvas/pro2-spawn-select";
import {
  buildSbv1ImageNodeData,
  buildSbv1VideoEngineNodeData,
  selectSbv1NodeAfterSpawn,
} from "@/lib/canvas/sbv1-spawn-nodes";
import { useCanvasStore } from "@/lib/canvas/store";
import { NODE_DEFAULT_SIZE, type CanvasFlowNode } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";
import { BatchConnectPreviewLines } from "./batch-connect-preview-lines";
import {
  BatchConnectSpawnMenu,
  type BatchConnectSpawnMenuItem,
} from "./batch-connect-spawn-menu";

const DRAG_THRESHOLD = 3;

const SPAWN_MENU_OFFSET_X = 12;

const VIDEO_EXPORT_MENU_ITEMS: BatchConnectSpawnMenuItem[] = [
  {
    id: "export",
    label: "导出剪辑",
    icon: Download,
    nodeType: "jianying-export-pro2",
  },
];

const IMAGE_PIPELINE_MENU_ITEMS: BatchConnectSpawnMenuItem[] = [
  {
    id: "img2img",
    label: "图生图",
    icon: Sparkles,
    nodeType: "story-pro2-image",
  },
  {
    id: "img2video",
    label: "图生视频",
    icon: Video,
    nodeType: "sbv1-video-engine",
  },
];

function Pro2SelectionBatchConnectLayerInner({
  rfNodes,
}: {
  rfNodes: CanvasFlowNode[];
}) {
  const { flowToScreenPosition, screenToFlowPosition, getInternalNode } =
    useReactFlow();
  const viewportMoving = useCanvasStore((s) => s.canvasViewportMoving);
  const storeNodes = useCanvasStore((s) => s.nodes);
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

  const eligibleSources = useMemo(() => {
    const raw = nodesEligibleForBatchOut(storeNodes, selectedIds);
    const mode = classifyBatchConnectMode(raw);
    if (!mode) return [];
    return raw;
  }, [storeNodes, selectedIds]);

  const batchMode = useMemo(
    () => classifyBatchConnectMode(eligibleSources),
    [eligibleSources],
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

  const spawnAtAnchor = useCallback(
    (
      anchor: { x: number; y: number },
      nodeType:
        | "jianying-export-pro2"
        | "story-pro2-image"
        | "sbv1-image"
        | "sbv1-video-engine",
      targetHandle: string,
      data?: Record<string, unknown>,
    ) => {
      if (eligibleSources.length < 2) return;
      const { height } = NODE_DEFAULT_SIZE[nodeType];
      const flow = screenToFlowPosition({ x: anchor.x, y: anchor.y });
      const newId = addNode(
        nodeType,
        {
          x: flow.x + SPAWN_MENU_OFFSET_X,
          y: flow.y - height / 2,
        },
        data,
      );
      if (!newId) return;
      connectBatchToTarget(newId, targetHandle);
      clearPreview();
      if (nodeType === "sbv1-video-engine" || nodeType === "sbv1-image") {
        selectSbv1NodeAfterSpawn(setNodes, newId);
      } else {
        selectPro2NodeAfterSpawn(setNodes, newId);
      }
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

  const spawnExportAndConnect = useCallback(
    (anchor: { x: number; y: number }) => {
      spawnAtAnchor(anchor, "jianying-export-pro2", "in_video", {
        label: "导出剪辑",
      });
    },
    [spawnAtAnchor],
  );

  const spawnImg2ImgAndConnect = useCallback(
    (anchor: { x: number; y: number }) => {
      const nodeType = batchImageSpawnNodeType(eligibleSources);
      spawnAtAnchor(
        anchor,
        nodeType,
        "in_image",
        nodeType === "sbv1-image"
          ? buildSbv1ImageNodeData()
          : buildPro2ImageNodeData(),
      );
    },
    [eligibleSources, spawnAtAnchor],
  );

  const spawnImg2VideoAndConnect = useCallback(
    (anchor: { x: number; y: number }) => {
      spawnAtAnchor(
        anchor,
        "sbv1-video-engine",
        "in_ref",
        buildSbv1VideoEngineNodeData(),
      );
    },
    [spawnAtAnchor],
  );

  const closeMenu = useCallback(() => {
    menuOpenRef.current = false;
    setMenuAnchor(null);
    setLineTarget(null);
    setConnectingFrom(null);
  }, [setConnectingFrom]);

  const connectSnapTarget = useCallback(
    (target: CanvasFlowNode, mode: BatchConnectMode): boolean => {
      const sample = eligibleSources[0];
      if (!sample) return false;
      const handle = batchConnectTargetHandleForSnap(target, sample, mode);
      if (!handle) return false;
      connectBatchToTarget(target.id, handle);
      clearPreview();
      return true;
    },
    [eligibleSources, connectBatchToTarget, clearPreview],
  );

  const finishDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!batchMode) return;
      pointerCleanupRef.current?.();
      pointerCleanupRef.current = null;
      setDragging(false);
      gestureRef.current = null;

      const flowPoint = screenToFlowPosition({ x: clientX, y: clientY });
      const target = findBatchConnectSnapTarget(
        storeNodes,
        flowPoint,
        selectedIds,
        batchMode,
      );

      if (target && !selectedIds.includes(target.id)) {
        if (connectSnapTarget(target, batchMode)) return;
      }

      menuOpenRef.current = true;
      setMenuAnchor({ x: clientX, y: clientY });
      setLineTarget({ x: clientX, y: clientY });
      setConnectingFrom(eligibleSources[0]?.id ?? null);
    },
    [
      batchMode,
      screenToFlowPosition,
      storeNodes,
      selectedIds,
      eligibleSources,
      connectSnapTarget,
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
    if (eligibleSources.length < 2 || !batchMode) return;
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

  const onMenuPick = useCallback(
    (itemId: string) => {
      if (!menuAnchor) return;
      if (batchMode === "video-export" && itemId === "export") {
        spawnExportAndConnect(menuAnchor);
        return;
      }
      if (batchMode === "image-pipeline") {
        if (itemId === "img2img") spawnImg2ImgAndConnect(menuAnchor);
        if (itemId === "img2video") spawnImg2VideoAndConnect(menuAnchor);
      }
    },
    [
      menuAnchor,
      batchMode,
      spawnExportAndConnect,
      spawnImg2ImgAndConnect,
      spawnImg2VideoAndConnect,
    ],
  );

  if (
    viewportMoving ||
    selectedIds.length < 2 ||
    eligibleSources.length < 2 ||
    !batchMode ||
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

  const menuTitle =
    batchMode === "image-pipeline"
      ? `为所选中的 ${eligibleSources.length} 张图片生成`
      : `为所选中的 ${eligibleSources.length} 个视频生成`;

  const menuItems =
    batchMode === "image-pipeline"
      ? IMAGE_PIPELINE_MENU_ITEMS
      : VIDEO_EXPORT_MENU_ITEMS;

  const plusTitle =
    batchMode === "image-pipeline"
      ? "批量连线 · 图生图 / 图生视频 / 拖到已有节点"
      : "批量连线 · 导出剪辑 / 拖到已有节点";

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
        title={plusTitle}
        onPointerDown={onPlusPointerDown}
      >
        <Plus className="size-6 text-white/90" strokeWidth={2.25} />
      </button>

      {menuAnchor ? (
        <BatchConnectSpawnMenu
          anchor={menuAnchor}
          title={menuTitle}
          items={menuItems}
          onPick={onMenuPick}
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
