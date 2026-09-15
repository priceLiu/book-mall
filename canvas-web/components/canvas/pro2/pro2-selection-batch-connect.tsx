"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReactFlow, useStore } from "@xyflow/react";
import { Plus, Clapperboard, Download } from "lucide-react";

import { pointerBlocksSidePlusMagnet } from "@/lib/canvas/canvas-form-wheel";
import { useClientPortalMounted } from "@/lib/canvas/use-modal-portal-effects";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import { useCanvasMarqueeSelecting } from "@/lib/canvas/use-canvas-marquee-selecting";
import {
  computeBatchConnectMagnetFlowOffset,
  LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
  LIBTV_SIDE_PLUS_MAGNET_ACTIVATE_PX,
  LIBTV_SIDE_PLUS_MAGNET_RELEASE_PX,
  pointerNearBatchConnectMagnetEdge,
} from "@/lib/canvas/libtv-node-chrome";
import { libtvSelectionFlowBox } from "@/lib/canvas/libtv-marquee-hit";
import { findBatchConnectSnapTarget } from "@/lib/canvas/libtv-connection-snap";
import { batchConnectSourceClientPoint } from "@/lib/canvas/batch-connect-preview-anchors";
import {
  batchConnectTargetHandleForSnap,
  batchImageSpawnNodeType,
  BATCH_MEDIA_SPAWN_MENU_ITEMS,
  buildBatchConnectEdges,
  classifyBatchConnectMode,
  nodesEligibleForBatchOut,
  type BatchConnectMode,
} from "@/lib/canvas/pro2-batch-connect";
import { libtvSelectionFlowBoxToScreenBox } from "@/lib/canvas/batch-connect-preview-anchors";
import {
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

const MEDIA_PIPELINE_MENU_ITEMS: BatchConnectSpawnMenuItem[] =
  BATCH_MEDIA_SPAWN_MENU_ITEMS.map((item) => ({ ...item }));

/** 松手后忽略画布 pane 清空选区（与框选 onSelectionEnd 同机制） */
function suppressNextCanvasPaneClick(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("canvas:suppress-next-pane-click"));
}

function Pro2SelectionBatchConnectLayerInner({
  rfNodes,
}: {
  rfNodes: CanvasFlowNode[];
}) {
  const { flowToScreenPosition, screenToFlowPosition, getInternalNode } =
    useReactFlow();
  const marqueeSelecting = useCanvasMarqueeSelecting();
  const storeNodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const canvasDraggingNodeId = useCanvasStore((s) => s.canvasDraggingNodeId);
  const canvasGeometryDragging = useCanvasStore((s) => s.canvasGeometryDragging);

  const selectedIds = useMemo(
    () => pro2SelectedNonGroupIds(rfNodes),
    [rfNodes],
  );

  /** 与 LibtvMultiSelectionOutline 同一套选区 id / flow 框 */
  const outlineSelectedIds = useMemo(
    () => rfNodes.filter((n) => n.selected).map((n) => n.id),
    [rfNodes],
  );

  const rfDom = useStore((s) => s.domNode);
  const zoom = useStore((s) => s.transform[2]) || 1;
  const viewportEl =
    rfDom?.querySelector<HTMLElement>(".react-flow__viewport") ?? null;

  /** 多选期间始终订阅 viewport，缩小画布时 + 位置跟随 pan/zoom */
  const viewport = useViewportTransformActive(outlineSelectedIds.length >= 2);

  const eligibleSources = useMemo(() => {
    const raw = nodesEligibleForBatchOut(storeNodes, selectedIds);
    if (classifyBatchConnectMode(raw)) return raw;
    return [];
  }, [storeNodes, selectedIds]);

  const batchMode = useMemo(
    () => classifyBatchConnectMode(eligibleSources),
    [eligibleSources],
  );

  const spawnMenuItems = useMemo((): BatchConnectSpawnMenuItem[] => {
    if (batchMode === "video-export") return VIDEO_EXPORT_MENU_ITEMS;
    if (batchMode === "media-pipeline") return MEDIA_PIPELINE_MENU_ITEMS;
    return [];
  }, [batchMode]);

  const spawnMenuTitle = useMemo(() => {
    if (batchMode === "video-export") return "工作环节";
    if (batchMode === "media-pipeline") return "批量连线";
    return "";
  }, [batchMode]);

  const flowBox = useMemo(() => {
    if (outlineSelectedIds.length < 2) return null;
    const pool = (rfNodes.length ? rfNodes : storeNodes) as CanvasFlowNode[];
    return libtvSelectionFlowBox(pool, outlineSelectedIds);
  }, [outlineSelectedIds, rfNodes, storeNodes]);

  const screenBox = useMemo(() => {
    void viewport;
    if (!flowBox) return null;
    return libtvSelectionFlowBoxToScreenBox(flowBox, flowToScreenPosition);
  }, [flowBox, viewport, flowToScreenPosition]);

  const pinnedFlowBoxRef = useRef<typeof flowBox>(null);

  useEffect(() => {
    if (flowBox) pinnedFlowBoxRef.current = flowBox;
  }, [flowBox]);

  const [magnetOffset, setMagnetOffset] = useState({ x: 0, y: 0 });
  const magnetActiveRef = useRef(false);
  const frozenMagnetRef = useRef({ x: 0, y: 0 });

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
  const frozenFlowBoxRef = useRef<typeof flowBox>(null);
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

  /** 悬停磁吸 · 框选沿全高跟随（flow 坐标 · 与 viewport 内 + 同语义） */
  const hoverMagnetOffsetForPointer = useCallback(
    (clientX: number, clientY: number, box: NonNullable<typeof screenBox>) => {
      return computeBatchConnectMagnetFlowOffset(
        clientX,
        clientY,
        box,
        "right",
        zoom,
      );
    },
    [zoom],
  );

  const capturePreviewSourcePoints = useCallback(() => {
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
    previewSourcesCapturedRef.current = points.length >= 2;
    setPreviewSourcePoints(points);
    return points;
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
    frozenFlowBoxRef.current = null;
    frozenMagnetRef.current = { x: 0, y: 0 };
    setDragging(false);
    setMenuAnchor(null);
    menuOpenRef.current = false;
    setLineTarget(null);
    setPreviewSourcePoints([]);
    gestureRef.current = null;
  }, []);

  const closeMenuOnly = useCallback(() => {
    setMenuAnchor(null);
    menuOpenRef.current = false;
  }, []);

  useEffect(() => {
    if (gestureActiveRef.current || dragging || menuAnchor) return;
    if (canvasDraggingNodeId || canvasGeometryDragging) {
      clearPreview();
    }
  }, [
    canvasDraggingNodeId,
    canvasGeometryDragging,
    dragging,
    menuAnchor,
    clearPreview,
  ]);

  useEffect(() => {
    if (selectedIds.length < 2) {
      clearPreview();
      magnetActiveRef.current = false;
      setMagnetOffset({ x: 0, y: 0 });
    }
  }, [selectedIds.length, clearPreview]);

  const magnetFollowEnabled =
    selectedIds.length >= 2 &&
    eligibleSources.length >= 2 &&
    Boolean(batchMode) &&
    Boolean(screenBox) &&
    !marqueeSelecting &&
    !dragging &&
    menuAnchor == null;

  useEffect(() => {
    if (!magnetFollowEnabled || !screenBox) {
      magnetActiveRef.current = false;
      setMagnetOffset({ x: 0, y: 0 });
      return;
    }

    const rect = {
      top: screenBox.top,
      bottom: screenBox.bottom,
      left: screenBox.left,
      right: screenBox.right,
      height: screenBox.height,
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerBlocksSidePlusMagnet(e.clientX, e.clientY)) {
        magnetActiveRef.current = false;
        setMagnetOffset({ x: 0, y: 0 });
        return;
      }
      const activate = pointerNearBatchConnectMagnetEdge(
        e.clientX,
        e.clientY,
        rect,
        "right",
        LIBTV_SIDE_PLUS_MAGNET_ACTIVATE_PX,
      );
      const release = pointerNearBatchConnectMagnetEdge(
        e.clientX,
        e.clientY,
        rect,
        "right",
        LIBTV_SIDE_PLUS_MAGNET_RELEASE_PX,
      );
      if (magnetActiveRef.current) {
        if (!release) {
          magnetActiveRef.current = false;
          setMagnetOffset({ x: 0, y: 0 });
          return;
        }
        setMagnetOffset(
          hoverMagnetOffsetForPointer(e.clientX, e.clientY, screenBox),
        );
        return;
      }
      if (!activate) {
        setMagnetOffset({ x: 0, y: 0 });
        return;
      }
      magnetActiveRef.current = true;
      setMagnetOffset(
        hoverMagnetOffsetForPointer(e.clientX, e.clientY, screenBox),
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
  }, [magnetFollowEnabled, screenBox, hoverMagnetOffsetForPointer]);

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
      targetHandle?: string,
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
        undefined,
        buildSbv1VideoEngineNodeData(),
      );
    },
    [spawnAtAnchor],
  );

  const closeMenu = useCallback(() => {
    clearPreview();
  }, [clearPreview]);

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
  if (gestureActive && flowBox) {
    frozenFlowBoxRef.current = flowBox;
  } else if (!gestureActive) {
    frozenFlowBoxRef.current = null;
  }

  const layoutFlowBox =
    gestureActive && frozenFlowBoxRef.current
      ? frozenFlowBoxRef.current
      : flowBox ?? pinnedFlowBoxRef.current;

  /** 拖线 / 菜单期间冻结 +（同组侧 + 进入 RF 连线后不再磁吸） */
  const activeMagnetOffset =
    dragging || menuAnchor != null ? frozenMagnetRef.current : magnetOffset;

  const onPlusPointerDown = (e: React.PointerEvent) => {
    if (eligibleSources.length < 2 || !batchMode) return;
    e.preventDefault();
    e.stopPropagation();

    pointerCleanupRef.current?.();
    closeMenuOnly();

    const plusEl = e.currentTarget as HTMLElement;
    plusEl.setPointerCapture(e.pointerId);

    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;

    gestureRef.current = {
      pointerId,
      x: startX,
      y: startY,
      moved: false,
    };
    const startBox = flowBox ?? pinnedFlowBoxRef.current;
    if (startBox) frozenFlowBoxRef.current = startBox;
    const startOffset = { ...magnetOffset };
    frozenMagnetRef.current = startOffset;
    magnetActiveRef.current = false;
    gestureActiveRef.current = true;
    capturePreviewSourcePoints();
    setDragging(true);
    scheduleLineTarget({ x: startX, y: startY });

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
      if (plusEl.hasPointerCapture(pointerId)) {
        plusEl.releasePointerCapture(pointerId);
      }
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
      if (plusEl.hasPointerCapture(pointerId)) {
        plusEl.releasePointerCapture(pointerId);
      }
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
    };
  };

  const onMenuPick = useCallback(
    (itemId: string) => {
      if (!menuAnchor || !batchMode) return;
      if (batchMode === "video-export") {
        if (itemId === "export") spawnExportAndConnect(menuAnchor);
        if (itemId === "auto-render") spawnAutoRenderAndConnect(menuAnchor);
        closeMenu();
        return;
      }
      if (batchMode === "media-pipeline") {
        if (itemId === "img2img") spawnImg2ImgAndConnect(menuAnchor);
        if (itemId === "img2video") spawnImg2VideoAndConnect(menuAnchor);
        closeMenu();
      }
    },
    [
      menuAnchor,
      batchMode,
      spawnExportAndConnect,
      spawnAutoRenderAndConnect,
      spawnImg2ImgAndConnect,
      spawnImg2VideoAndConnect,
      closeMenu,
    ],
  );

  if (
    (marqueeSelecting && !gestureActiveRef.current) ||
    selectedIds.length < 2 ||
    eligibleSources.length < 2 ||
    !batchMode ||
    !layoutFlowBox ||
    !viewportEl
  ) {
    return null;
  }

  const plusAnchorX = layoutFlowBox.x + layoutFlowBox.w;
  const plusAnchorY = layoutFlowBox.y + layoutFlowBox.h / 2;
  const plusTransform = `translate(${plusAnchorX}px, ${plusAnchorY}px) translate(calc(-50% + ${-activeMagnetOffset.x}px), calc(-50% + ${activeMagnetOffset.y}px))`;

  const showPreviewLines =
    lineTarget && (dragging || menuAnchor) && previewSourcePoints.length >= 2;

  const plusTitle =
    batchMode === "media-pipeline"
      ? "批量连线 · 图生图 / 图生视频 / 拖到已有节点"
      : "批量连线 · 导出剪辑 / 拖到已有节点";

  const plusButton = (
    <button
      type="button"
      className={cn(
        "pro2-node-side-plus-dot pro2-node-side-plus-dot--lg",
        LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
        "nopan nodrag nowheel flex items-center justify-center rounded-full",
        "border border-white/25 bg-[#2a2a2e] shadow-[0_4px_16px_rgba(0,0,0,0.45)]",
        "hover:border-violet-400/60 hover:bg-violet-500/25",
        dragging && "border-violet-400/60 bg-violet-500/25",
      )}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: plusTransform,
      }}
      title={plusTitle}
      onPointerDown={onPlusPointerDown}
    >
      <Plus className="pointer-events-none size-10 text-white/90" strokeWidth={2.25} />
    </button>
  );

  return (
    <>
      {showPreviewLines
        ? createPortal(
            <BatchConnectPreviewLines
              sources={eligibleSources}
              allNodes={storeNodes}
              cursor={lineTarget}
              flowToScreenPosition={flowToScreenPosition}
              getInternalNode={getInternalNode}
              sourcePoints={previewSourcePoints}
            />,
            document.body,
          )
        : null}

      {createPortal(plusButton, viewportEl)}

      {menuAnchor && spawnMenuItems.length > 0
        ? createPortal(
            <BatchConnectSpawnMenu
              anchor={menuAnchor}
              title={spawnMenuTitle}
              items={spawnMenuItems}
              onPick={onMenuPick}
              onClose={closeMenu}
            />,
            document.body,
          )
        : null}
    </>
  );
}

/** 框选批量连线 UI · + 在 RF viewport（与虚线框同坐标系），预览线 / 菜单在 body */
export function Pro2SelectionBatchConnectLayer({
  rfNodes,
}: {
  rfNodes: CanvasFlowNode[];
}) {
  const mounted = useClientPortalMounted();
  if (!mounted) return null;
  return <Pro2SelectionBatchConnectLayerInner rfNodes={rfNodes} />;
}
