"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReactFlow } from "@xyflow/react";
import { Clapperboard, Download, Plus, Sparkles, Video } from "lucide-react";

import { useClientPortalMounted } from "@/lib/canvas/use-modal-portal-effects";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import { findBatchConnectSnapTarget } from "@/lib/canvas/libtv-connection-snap";
import { batchConnectSourceClientPoint } from "@/lib/canvas/batch-connect-preview-anchors";
import {
  batchConnectTargetHandleForSnap,
  batchImageSpawnNodeType,
  buildBatchConnectEdges,
  classifyBatchConnectMode,
  nodesEligibleForBatchOut,
  type BatchConnectMode,
} from "@/lib/canvas/pro2-batch-connect";
import { batchConnectSelectionScreenBox } from "@/lib/canvas/batch-connect-preview-anchors";
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
import {
  resolveJianyingAutoRenderNodeSize,
  withFlowNodeDimensions,
} from "@/lib/canvas/jianying-auto-render-node-size";
import { ensureNodeDragHandles, sortNodesForReactFlow } from "@/lib/canvas/normalize-graph-nodes";
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

/** 松手后忽略画布 pane 清空选区（与框选 onSelectionEnd 同机制） */
function suppressNextCanvasPaneClick(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("canvas:suppress-next-pane-click"));
}

const VIDEO_EXPORT_MENU_ITEMS: BatchConnectSpawnMenuItem[] = [
  {
    id: "auto-render",
    label: "自动成片",
    icon: Clapperboard,
    nodeType: "jianying-auto-render-pro2",
  },
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

  const screenBox = useMemo(() => {
    void viewport;
    const pool = (rfNodes.length ? rfNodes : storeNodes) as CanvasFlowNode[];
    return batchConnectSelectionScreenBox(
      selectedIds,
      pool,
      flowToScreenPosition,
      getInternalNode,
    );
  }, [
    selectedIds,
    viewport,
    rfNodes,
    storeNodes,
    flowToScreenPosition,
    getInternalNode,
  ]);

  const [dragging, setDragging] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [lineTarget, setLineTarget] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [previewSourcePoints, setPreviewSourcePoints] = useState<
    { x: number; y: number }[]
  >([]);
  const frozenScreenBoxRef = useRef<typeof screenBox>(null);
  const gestureActiveRef = useRef(false);
  const gestureRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const pointerCleanupRef = useRef<(() => void) | null>(null);
  const menuOpenRef = useRef(false);
  const lineTargetRafRef = useRef<number | null>(null);
  const pendingLineTargetRef = useRef<{ x: number; y: number } | null>(null);
  const previewSourcesCapturedRef = useRef(false);

  const scheduleLineTarget = useCallback((pt: { x: number; y: number }) => {
    pendingLineTargetRef.current = pt;
    if (lineTargetRafRef.current != null) return;
    lineTargetRafRef.current = window.requestAnimationFrame(() => {
      lineTargetRafRef.current = null;
      const next = pendingLineTargetRef.current;
      if (next) setLineTarget(next);
    });
  }, []);

  const capturePreviewSourcePoints = useCallback(() => {
    if (previewSourcesCapturedRef.current) return;
    previewSourcesCapturedRef.current = true;
    const points = eligibleSources
      .map((node) =>
        batchConnectSourceClientPoint(
          node,
          storeNodes,
          flowToScreenPosition,
          getInternalNode,
        ),
      )
      .filter((p): p is { x: number; y: number } => p != null);
    setPreviewSourcePoints(points);
  }, [eligibleSources, storeNodes, flowToScreenPosition, getInternalNode]);

  const openSpawnMenu = useCallback((anchor: { x: number; y: number }) => {
    menuOpenRef.current = true;
    gestureActiveRef.current = true;
    suppressNextCanvasPaneClick();
    setMenuAnchor(anchor);
  }, []);

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
    if (lineTargetRafRef.current != null) {
      window.cancelAnimationFrame(lineTargetRafRef.current);
      lineTargetRafRef.current = null;
    }
    pendingLineTargetRef.current = null;
    previewSourcesCapturedRef.current = false;
    gestureActiveRef.current = false;
    frozenScreenBoxRef.current = null;
    setDragging(false);
    setMenuAnchor(null);
    menuOpenRef.current = false;
    setLineTarget(null);
    setPreviewSourcePoints([]);
    gestureRef.current = null;
  }, []);

  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);

  const spawnAtAnchor = useCallback(
    (
      anchor: { x: number; y: number },
      nodeType:
        | "jianying-export-pro2"
        | "jianying-auto-render-pro2"
        | "story-pro2-image"
        | "sbv1-image"
        | "sbv1-video-engine",
      targetHandle: string,
      data?: Record<string, unknown>,
    ) => {
      if (eligibleSources.length < 2) return;
      const { height } = NODE_DEFAULT_SIZE[nodeType];
      const flow = screenToFlowPosition({ x: anchor.x, y: anchor.y });
      const sharedParentId = eligibleSources.every(
        (n) => n.parentId && n.parentId === eligibleSources[0]?.parentId,
      )
        ? eligibleSources[0]?.parentId
        : undefined;
      let newId = "";
      if (nodeType === "jianying-auto-render-pro2" && sharedParentId) {
        // 批量连线来自同一组：成片节点进组，拖组时一起移动
        const absXs = eligibleSources.map((n) => n.position.x + (n.width ?? 320));
        const absYs = eligibleSources.map((n) => n.position.y);
        newId = addNodeInGroup(
          nodeType,
          sharedParentId,
          {
            x: Math.max(...absXs) + 48,
            y: Math.min(...absYs),
          },
          data,
        );
      } else {
        newId = addNode(
          nodeType,
          {
            x: flow.x + SPAWN_MENU_OFFSET_X,
            y: flow.y - height / 2,
          },
          data,
        );
      }
      if (!newId) return;
      connectBatchToTarget(newId, targetHandle);
      clearPreview();
      if (nodeType === "jianying-auto-render-pro2") {
        const size = resolveJianyingAutoRenderNodeSize({
          sourceNodes: eligibleSources,
          nodes: useCanvasStore.getState().nodes,
        });
        setNodes((prev) =>
          ensureNodeDragHandles(
            sortNodesForReactFlow(
              prev.map((n) =>
                n.id === newId
                  ? withFlowNodeDimensions(n, size.width, size.height)
                  : n,
              ),
            ),
          ),
        );
      }
      if (nodeType === "sbv1-video-engine" || nodeType === "sbv1-image") {
        selectSbv1NodeAfterSpawn(setNodes, newId);
      } else {
        selectPro2NodeAfterSpawn(setNodes, newId);
      }
    },
    [
      eligibleSources,
      screenToFlowPosition,
      addNode,
      addNodeInGroup,
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

  const spawnAutoRenderAndConnect = useCallback(
    (anchor: { x: number; y: number }) => {
      spawnAtAnchor(anchor, "jianying-auto-render-pro2", "in_video", {
        label: "自动成片",
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
    gestureActiveRef.current = false;
    frozenScreenBoxRef.current = null;
    setMenuAnchor(null);
    setLineTarget(null);
  }, []);

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
      setLineTarget({ x: clientX, y: clientY });

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
      openSpawnMenu({ x: clientX, y: clientY });
    },
    [
      batchMode,
      screenToFlowPosition,
      storeNodes,
      selectedIds,
      connectSnapTarget,
      openSpawnMenu,
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

  useEffect(() => {
    const onPaneClick = () => {
      if (menuOpenRef.current) return;
      clearPreview();
      closeMenu();
    };
    window.addEventListener("canvas:pro2-pane-click", onPaneClick);
    return () => window.removeEventListener("canvas:pro2-pane-click", onPaneClick);
  }, [clearPreview, closeMenu]);

  const gestureActive = dragging || menuAnchor != null;
  gestureActiveRef.current = gestureActive;
  if (gestureActive && screenBox) {
    frozenScreenBoxRef.current = screenBox;
  } else if (!gestureActive) {
    frozenScreenBoxRef.current = null;
  }
  const layoutBox =
    gestureActive && frozenScreenBoxRef.current
      ? frozenScreenBoxRef.current
      : screenBox;

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
    previewSourcesCapturedRef.current = false;
    setPreviewSourcePoints([]);
    gestureActiveRef.current = true;
    setDragging(true);
    scheduleLineTarget({ x: startX, y: startY });
    window.requestAnimationFrame(() => {
      capturePreviewSourcePoints();
    });

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      scheduleLineTarget({ x: ev.clientX, y: ev.clientY });
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
      suppressNextCanvasPaneClick();
      if (moved) {
        finishDrag(ev.clientX, ev.clientY);
      } else {
        setDragging(false);
        gestureRef.current = null;
        setPreviewSourcePoints([]);
        previewSourcesCapturedRef.current = false;
        openSpawnMenu({ x: ev.clientX, y: ev.clientY });
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
      if (batchMode === "video-export" && itemId === "auto-render") {
        spawnAutoRenderAndConnect(menuAnchor);
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
      spawnAutoRenderAndConnect,
      spawnImg2ImgAndConnect,
      spawnImg2VideoAndConnect,
    ],
  );

  if (
    viewportMoving ||
    selectedIds.length < 2 ||
    eligibleSources.length < 2 ||
    !batchMode ||
    !layoutBox
  ) {
    return null;
  }

  const boxLeft = layoutBox.left;
  const boxTop = layoutBox.top;
  const boxWidth = layoutBox.width;
  const boxHeight = layoutBox.height;
  const plusLeft = layoutBox.right + 4;
  const plusTop = layoutBox.midY;

  const showPreviewLines =
    lineTarget && (dragging || menuAnchor) && previewSourcePoints.length >= 2;

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
          sourcePoints={previewSourcePoints}
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
