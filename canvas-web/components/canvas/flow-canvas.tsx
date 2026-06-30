"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutTemplate } from "lucide-react";
import {
  Background,
  BackgroundVariant,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeChange,
  type OnConnectEnd,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  isCanvasInteractiveGeometryInProgress,
  isCanvasPositionCommitOnly,
  isCanvasSelectionOnlyChange,
} from "@/lib/canvas/canvas-node-changes";
import { resolveLibtvFloatingDockSelection } from "@/lib/canvas/libtv-floating-dock-selection";
import { cloneCanvasNodeData } from "@/lib/canvas/clone-node-data";
import {
  isPro2StyledGroup,
  syncPro2MediaGroupZIndex,
} from "@/lib/canvas/pro2-media-group-meta";
import type {
  CanvasFlowEdge,
  CanvasFlowNode,
  CanvasNodeType,
} from "@/lib/canvas/types";
import { buildTextNodeDataFromPreset } from "@/lib/canvas/text-templates";
import { buildImageEngineDataFromPreset } from "@/lib/canvas/image-engine-presets";
import { uploadCanvasImage } from "@/lib/canvas-api";
import { normalizeCanvasImageFile } from "@/lib/canvas/normalize-canvas-image-file";
import {
  registerCanvasViewportPlacement,
  unregisterCanvasViewportPlacement,
} from "@/lib/canvas/viewport-placement";
import {
  insertProjectAssetViaCanvasBridge,
  parseProjectAssetDragPayload,
} from "@/lib/canvas/spawn-project-asset-on-canvas";
import { ensureNodeDragHandles } from "@/lib/canvas/normalize-graph-nodes";
import { mergeStoreNodesIntoRf } from "@/lib/canvas/canvas-rf-sync";
import { resolveSnapConnectionOnNodeHit } from "@/lib/canvas/libtv-connection-snap";
import {
  isLibtvSidePlusConnectHandle,
  resolveLibtvSideConnectMenu,
} from "@/lib/canvas/libtv-side-connect-menu";
import {
  applyDragSnapToNode,
  computeDragSnap,
  filterNearbySnapCandidates,
  nodeSnapBox,
  snapGuideKey,
  type NodeSnapBox,
  type SnapGuideLine,
} from "@/lib/canvas/canvas-drag-snap";
import { onCanvasWheelCapture } from "@/lib/canvas/canvas-form-wheel";
import { canvasNotify } from "@/lib/canvas/canvas-notify";
import { validateStoryPipelineDeletion } from "@/lib/canvas/story-pipeline-delete-guard";
import {
  allImageFilesFromDataTransfer,
  resolveClipboardImageFiles,
  isEditablePasteTarget,
  getLastPointerClient,
  isImagePasteSlotTarget,
  pickPointerImagePasteHandler,
  routeClipboardImageToActivePasteSlot,
} from "@/lib/canvas/image-upload-handlers";
import { memoizedNodeTypes } from "./memoized-node-types";
import { CanvasViewportToolbar } from "./canvas-viewport-toolbar";
import { CanvasBackgroundVideoPanel } from "./canvas-background-video-panel";
import { SelectionToolbar } from "./selection-toolbar";
import { Pro2FloatingInspector } from "./pro2/pro2-floating-inspector";
import { Pro2FrameCellInputDock } from "./pro2/pro2-frame-cell-input-dock";
import { Pro2MediaGroupToolbar } from "./pro2/pro2-media-group-toolbar";
import { Pro2SelectionToolbar } from "./pro2/pro2-selection-toolbar";
import { Pro2SelectionBatchConnectLayer } from "./pro2/pro2-selection-batch-connect";
import { LibtvSideConnectLayer } from "./pro2/libtv-side-connect-layer";
import { Pro2StarterInputDock } from "./pro2/pro2-starter-input-dock";
import { Pro2ScriptInputDock } from "./pro2/pro2-script-input-dock";
import { LibtvImageInputDock } from "./libtv-image-input-dock";
import { Sbv1MediaGroupToolbar } from "./sbv1/sbv1-media-group-toolbar";
import { Sbv1VideoEngineFloatingDock } from "./sbv1/sbv1-video-engine-floating-dock";
import { Pro2ThreeViewInputDock } from "./pro2/pro2-three-view-input-dock";
import { Pro2TextNodeOutlineEditorHost } from "./pro2/pro2-text-node-outline-editor-host";
import { Pro2ScriptTableEditorHost } from "./pro2/pro2-script-table-editor-host";
import type {
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
} from "@/lib/canvas/story-pro-workspace-types";
import {
  pro2HubHasCharacterTable,
  pro2HubHasOutlineContent,
  pro2HubHasScriptTable,
} from "@/lib/canvas/pro2-script-hub-helpers";
import { DeletableEdge } from "./edges/deletable-edge";
import {
  CanvasPaneContextMenu,
  type CanvasPaneContextMenuItem,
} from "./canvas-pane-context-menu";
import { CanvasSnapGuidesOverlay } from "./canvas-snap-guides-overlay";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { PRO2_TOOLBAR_ADD_MENU } from "@/lib/canvas/pro2-add-node-menu";
import {
  handlePro2ToolbarAddNodePick,
  type Pro2AddNodePickStore,
} from "@/lib/canvas/pro2-add-node-pick";
import { Pro2AddNodePopover } from "./pro2/pro2-add-node-popover";

const edgeTypes = {
  default: DeletableEdge,
} as const;

export const canvasFlowNodeTypes = memoizedNodeTypes;
export const canvasFlowEdgeTypes = edgeTypes;

/**
 * 进程内（同标签页）节点剪贴板。
 * 不进系统剪贴板，避免与"复制图片"混淆；用 sessionStorage 让 reload 后仍在。
 */
const CLIPBOARD_KEY = "canvas-web:node-clipboard";
type NodeClipboard = {
  nodes: { id: string; type?: string; data: Record<string, unknown>; position: { x: number; y: number } }[];
  edges: { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }[];
  /** 复制时所有节点的左上角 bbox（用于粘贴时按相对偏移落位） */
  origin: { x: number; y: number };
};

function FlowCanvasInner({
  projectId,
  forceOnlyRenderVisible = false,
  pro2FloatingInspector = false,
  sbv1Canvas = false,
}: {
  projectId: string;
  forceOnlyRenderVisible?: boolean;
  pro2FloatingInspector?: boolean;
  sbv1Canvas?: boolean;
}) {
  const libtvCanvas = pro2FloatingInspector || sbv1Canvas;
  const base = useBookMallBaseUrl();
  const wrapRef = useRef<HTMLDivElement>(null);
  const {
    screenToFlowPosition,
    fitView,
    setViewport: rfSetViewport,
    getNodes,
  } = useReactFlow();
  const initialFitDoneRef = useRef(false);
  const viewportTimerRef = useRef<number | null>(null);
  const dragHoverRafRef = useRef<number | null>(null);
  const dragSnapRafRef = useRef<number | null>(null);
  const snapOthersRef = useRef<NodeSnapBox[]>([]);
  const lastSnapGuideKeyRef = useRef("");
  const dragUndoPausedRef = useRef(false);
  const ignoreNextPaneClickRef = useRef(false);
  const [isNodeDragging, setIsNodeDragging] = useState(false);
  const isNodeDraggingRef = useRef(false);
  const [snapGuides, setSnapGuides] = useState<SnapGuideLine[]>([]);
  const deferStoreGraphSyncRef = useRef(false);

  const storeOnNodesChange = useCanvasStore((s) => s.onNodesChange);
  const storeOnEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState<CanvasFlowNode>(
    [],
  );
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState<CanvasFlowEdge>(
    [],
  );

  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const addNode = useCanvasStore((s) => s.addNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const openPro2TextOutlineEditor = useCanvasStore(
    (s) => s.openPro2TextOutlineEditor,
  );
  const openPro2ScriptTableEditor = useCanvasStore(
    (s) => s.openPro2ScriptTableEditor,
  );
  const setConnectingFrom = useCanvasStore((s) => s.setConnectingFrom);
  const dragHoverGroupId = useCanvasStore((s) => s.dragHoverGroupId);
  const setDragHoverGroup = useCanvasStore((s) => s.setDragHoverGroup);
  const reparentNode = useCanvasStore((s) => s.reparentNode);
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);
  const fitViewNonce = useCanvasStore((s) => s.fitViewNonce);
  const canvasFocusNodeId = useCanvasStore((s) => s.canvasFocusNodeId);
  const canvasFocusNonce = useCanvasStore((s) => s.canvasFocusNonce);
  const setCanvasGeometryDragging = useCanvasStore(
    (s) => s.setCanvasGeometryDragging,
  );
  const setCanvasDraggingNodeId = useCanvasStore(
    (s) => s.setCanvasDraggingNodeId,
  );
  const setCanvasViewportMoving = useCanvasStore(
    (s) => s.setCanvasViewportMoving,
  );

  const applyInitialViewport = useCallback(() => {
    if (initialFitDoneRef.current) return;
    const vp = useCanvasStore.getState().viewport;
    const laid = useCanvasStore.getState().nodes;
    if (laid.length === 0) return;
    initialFitDoneRef.current = true;
    const noSavedViewport =
      Math.abs(vp.x) < 1 &&
      Math.abs(vp.y) < 1 &&
      Math.abs(vp.zoom - 1) < 0.01;
    if (noSavedViewport) {
      void fitView({ padding: 0.12, duration: 0 });
    } else {
      void rfSetViewport(vp, { duration: 0 });
    }
  }, [fitView, rfSetViewport]);

  const enablePaneContextMenu = pro2FloatingInspector || sbv1Canvas;
  const enableDragSnapGuides = pro2FloatingInspector || sbv1Canvas;
  const { alert, confirm } = useDialogs();
  const [paneMenu, setPaneMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [paneAddMenu, setPaneAddMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const paneAddAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const closePaneMenu = useCallback(() => setPaneMenu(null), []);
  const closePaneAddMenu = useCallback(() => setPaneAddMenu(null), []);

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!enablePaneContextMenu) return;
      e.preventDefault();
      e.stopPropagation();
      setPaneMenu({ x: e.clientX, y: e.clientY });
    },
    [enablePaneContextMenu],
  );

  /** 兜底：部分环境下 RF onPaneContextMenu 未触发时，仍拦截空白 pane 右键 */
  useEffect(() => {
    if (!enablePaneContextMenu) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onNativeContextMenu = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(".react-flow__pane")) return;
      if (target.closest(".react-flow__node")) return;
      if (target.closest(".react-flow__edge")) return;
      onPaneContextMenu(e);
    };
    wrap.addEventListener("contextmenu", onNativeContextMenu, true);
    return () =>
      wrap.removeEventListener("contextmenu", onNativeContextMenu, true);
  }, [enablePaneContextMenu, onPaneContextMenu]);

  const openPaneAddMenuAt = useCallback(
    (clientX: number, clientY: number) => {
      closePaneMenu();
      ignoreNextPaneClickRef.current = true;
      const anchor = { x: clientX, y: clientY };
      paneAddAnchorRef.current = anchor;
      setPaneAddMenu(anchor);
    },
    [closePaneMenu],
  );

  /** RF 无 onPaneDoubleClick；空白 pane 双击弹出添加节点菜单（同底部 Dock +） */
  useEffect(() => {
    if (!enablePaneContextMenu) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onNativeDoubleClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(".react-flow__pane")) return;
      if (target.closest(".react-flow__node")) return;
      if (target.closest(".react-flow__edge")) return;
      e.preventDefault();
      e.stopPropagation();
      openPaneAddMenuAt(e.clientX, e.clientY);
    };
    wrap.addEventListener("dblclick", onNativeDoubleClick, true);
    return () => wrap.removeEventListener("dblclick", onNativeDoubleClick, true);
  }, [enablePaneContextMenu, openPaneAddMenuAt]);

  const paneMenuItems = useMemo<CanvasPaneContextMenuItem[]>(() => {
    const reflowAction = pro2FloatingInspector
      ? () => useCanvasStore.getState().reflowPro2Canvas()
      : sbv1Canvas
        ? () => useCanvasStore.getState().reflowSbv1Canvas()
        : null;
    if (!reflowAction) return [];
    return [
      {
        id: "canvas",
        label: "画布",
        children: [
          {
            id: "reflow",
            label: "重排",
            icon: LayoutTemplate,
            onClick: reflowAction,
          },
        ],
      },
    ];
  }, [pro2FloatingInspector, sbv1Canvas]);

  const onPaneAddPick = useCallback(
    async (itemId: string, nodeType?: string) => {
      const spawnAtScreen = paneAddAnchorRef.current ?? undefined;
      closePaneAddMenu();
      await handlePro2ToolbarAddNodePick(
        itemId,
        nodeType,
        {
          addNode: addNode as Pro2AddNodePickStore["addNode"],
          setNodes,
        },
        { alert, confirm },
        {
          edition: sbv1Canvas ? "sbv1" : "pro2",
          spawnAtScreen,
        },
      );
    },
    [addNode, setNodes, alert, confirm, sbv1Canvas, closePaneAddMenu],
  );

  useEffect(() => {
    initialFitDoneRef.current = false;
    setCanvasViewportMoving(false);
    const s = useCanvasStore.getState();
    setRfNodes(
      ensureNodeDragHandles(s.nodes).map((n) => ({ ...n, selected: false })),
    );
    s.setLibtvFloatingDockSelection(null, null);
    setRfEdges(s.edges);
  }, [projectId, setRfNodes, setRfEdges, setCanvasViewportMoving]);

  useEffect(() => {
    applyInitialViewport();
  }, [projectId, rfNodes.length, applyInitialViewport]);

  /** Zustand → RF 本地：hydrate / undo / 拖放结束等；拖动过程中跳过避免双写 */
  useEffect(() => {
    const unsub = useCanvasStore.subscribe((state, prev) => {
      if (deferStoreGraphSyncRef.current) return;
      if (state.nodes !== prev.nodes) {
        setRfNodes((rf) =>
          mergeStoreNodesIntoRf(rf, state.nodes, {
            preserveRfSelection: libtvCanvas,
          }),
        );
      }
      if (state.edges !== prev.edges) {
        setRfEdges(state.edges);
      }
    });
    return unsub;
  }, [setRfNodes, setRfEdges, libtvCanvas]);

  const onMoveStart = useCallback(() => {
    setCanvasViewportMoving(true);
    // pan/zoom 勿触发「拖动隐藏 Dock」；仅真实节点拖动才隐藏对应 Dock
    if (!isNodeDraggingRef.current) {
      setCanvasGeometryDragging(false);
      setCanvasDraggingNodeId(null);
    }
  }, [
    setCanvasViewportMoving,
    setCanvasGeometryDragging,
    setCanvasDraggingNodeId,
  ]);

  /** 勿用受控 viewport：节点轮询会频繁重渲染，store 里的旧视口会把滚轮缩放拉回 */
  const onMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, vp: Viewport) => {
      setCanvasViewportMoving(false);
      if (!isNodeDraggingRef.current) {
        setCanvasGeometryDragging(false);
        setCanvasDraggingNodeId(null);
      }
      if (viewportTimerRef.current !== null) {
        window.clearTimeout(viewportTimerRef.current);
      }
      viewportTimerRef.current = window.setTimeout(() => {
        setViewport(vp);
        viewportTimerRef.current = null;
      }, 350);
    },
    [
      setViewport,
      setCanvasViewportMoving,
      setCanvasGeometryDragging,
      setCanvasDraggingNodeId,
    ],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      let rfChanges = changes;
      const removeIds = changes
        .filter(
          (c): c is NodeChange & { type: "remove"; id: string } =>
            c.type === "remove" && "id" in c && typeof c.id === "string",
        )
        .map((c) => c.id);
      if (removeIds.length > 0) {
        const { nodes, edges } = useCanvasStore.getState();
        const validation = validateStoryPipelineDeletion(
          removeIds,
          nodes,
          edges,
        );
        const allowed = new Set(
          validation.ok
            ? validation.allowedIds
            : removeIds.filter((id) => !validation.blockedIds.includes(id)),
        );
        if (!validation.ok) {
          canvasNotify({
            title: "无法删除该节点",
            message: validation.message,
            variant: "error",
          });
        }
        rfChanges = changes.filter(
          (c) =>
            c.type !== "remove" ||
            ("id" in c && typeof c.id === "string" && allowed.has(c.id)),
        );
      }

      // 始终只更新本地 RF 状态 → 拖动每帧只重绘被拖节点，画面流畅
      onRfNodesChange(rfChanges);
      if (isCanvasInteractiveGeometryInProgress(changes)) {
        // 拖动 / 缩放过程中不写 zustand：避免每帧触发所有订阅 s.nodes 的节点重渲染
        // 终态（dragging:false / resizing:false）会在松手那帧落库
        deferStoreGraphSyncRef.current = true;
        setCanvasGeometryDragging(true);
        const draggingChange = changes.find(
          (c) =>
            c.type === "position" &&
            "dragging" in c &&
            c.dragging === true &&
            "id" in c &&
            c.id,
        );
        const resizingChange = changes.find(
          (c) =>
            c.type === "dimensions" &&
            "resizing" in c &&
            c.resizing === true &&
            "id" in c &&
            c.id,
        );
        if (draggingChange && "id" in draggingChange) {
          setCanvasDraggingNodeId(draggingChange.id);
        } else if (resizingChange) {
          // 拖角缩放不算「拖动节点」· 勿隐藏浮动 Dock
          setCanvasDraggingNodeId(null);
        }
        return;
      }
      const syncLibtvFloatingDockPinFromRf = () => {
        const sel = resolveLibtvFloatingDockSelection(
          getNodes() as CanvasFlowNode[],
        );
        useCanvasStore.getState().setLibtvFloatingDockSelection(
          sel?.nodeId ?? null,
          sel?.nodeType ?? null,
        );
      };

      // LibTV 画布：选中态仅保留在 RF 本地（不写 zustand / 不进 undo），避免点击卡顿
      if (libtvCanvas && isCanvasSelectionOnlyChange(changes)) {
        deferStoreGraphSyncRef.current = false;
        setCanvasGeometryDragging(false);
        setCanvasDraggingNodeId(null);
        syncLibtvFloatingDockPinFromRf();
        return;
      }
      if (libtvCanvas) {
        setCanvasGeometryDragging(false);
        setCanvasDraggingNodeId(null);
        // 坐标松手写入 store（不 normalize）；与 onNodeDragStop 双保险
        if (isCanvasPositionCommitOnly(changes)) {
          storeOnNodesChange(changes);
          syncLibtvFloatingDockPinFromRf();
          return;
        }
        deferStoreGraphSyncRef.current = false;
        const geometryChanges = rfChanges.filter((c) => c.type !== "select");
        if (geometryChanges.length > 0) {
          storeOnNodesChange(geometryChanges);
        }
        syncLibtvFloatingDockPinFromRf();
        return;
      }
      deferStoreGraphSyncRef.current = false;
      setCanvasGeometryDragging(false);
      setCanvasDraggingNodeId(null);
      storeOnNodesChange(rfChanges);
    },
    [
      onRfNodesChange,
      storeOnNodesChange,
      setCanvasGeometryDragging,
      setCanvasDraggingNodeId,
      libtvCanvas,
      getNodes,
    ],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof storeOnEdgesChange>[0]) => {
      onRfEdgesChange(changes);
      storeOnEdgesChange(changes);
    },
    [onRfEdgesChange, storeOnEdgesChange],
  );

  useEffect(
    () => () => {
      if (viewportTimerRef.current !== null) {
        window.clearTimeout(viewportTimerRef.current);
      }
      if (dragHoverRafRef.current !== null) {
        window.cancelAnimationFrame(dragHoverRafRef.current);
      }
      if (dragSnapRafRef.current !== null) {
        window.cancelAnimationFrame(dragSnapRafRef.current);
      }
      if (dragUndoPausedRef.current) {
        useCanvasStore.temporal.getState().resume();
        dragUndoPausedRef.current = false;
      }
      setCanvasGeometryDragging(false);
    },
    [setCanvasGeometryDragging],
  );

  const onInit = useCallback(() => {
    applyInitialViewport();
  }, [applyInitialViewport]);

  useEffect(() => {
    registerCanvasViewportPlacement({
      screenToFlowPosition,
      getContainer: () => wrapRef.current,
    });
    return () => unregisterCanvasViewportPlacement();
  }, [screenToFlowPosition]);

  useEffect(() => {
    if (fitViewNonce <= 0) return;
    const t = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.12, duration: 280 });
    });
    return () => window.cancelAnimationFrame(t);
  }, [fitViewNonce, fitView]);

  useEffect(() => {
    if (canvasFocusNonce <= 0 || !canvasFocusNodeId) return;
    const t = window.requestAnimationFrame(() => {
      void fitView({
        nodes: [{ id: canvasFocusNodeId }],
        padding: 0.35,
        duration: 280,
        maxZoom: 1.2,
      });
    });
    return () => window.cancelAnimationFrame(t);
  }, [canvasFocusNonce, canvasFocusNodeId, fitView]);

  /** 上传一个图片 File，并在指定位置创建 image 节点。返回新节点 id。 */
  const ingestImageFile = useCallback(
    async (
      file: File,
      position: { x: number; y: number },
      labelOverride?: string,
    ) => {
      let normalized = file;
      try {
        normalized = await normalizeCanvasImageFile(file);
      } catch (e) {
        const imageType: CanvasNodeType = sbv1Canvas
          ? "sbv1-image"
          : pro2FloatingInspector
            ? "story-pro2-image"
            : "image";
        const id = addNode(imageType, position, {
          uploading: false,
          uploadError: e instanceof Error ? e.message : String(e),
          label: labelOverride ?? file.name ?? "粘贴的图片",
        });
        return id;
      }
      const blobUrl = URL.createObjectURL(normalized);
      const imageType: CanvasNodeType = sbv1Canvas
        ? "sbv1-image"
        : pro2FloatingInspector
          ? "story-pro2-image"
          : "image";
      const id = addNode(imageType, position, {
        blobUrl,
        uploading: true,
        label: labelOverride ?? normalized.name ?? "粘贴的图片",
      });
      if (!base) {
        updateNodeData(id, {
          uploading: false,
          uploadError: "画布未就绪，请刷新后重试",
        });
        return id;
      }
      try {
        const ossUrl = await uploadCanvasImage(base, normalized);
        updateNodeData(id, { ossUrl, uploading: false });
      } catch (e) {
        updateNodeData(id, {
          uploading: false,
          uploadError: e instanceof Error ? e.message : String(e),
        });
      }
      return id;
    },
    [addNode, base, updateNodeData, pro2FloatingInspector, sbv1Canvas],
  );

  // ── 拖入分组归属：识别"鼠标当前是否在某个 group bbox 内"
  const findGroupAtPoint = useCallback(
    (clientX: number, clientY: number): string | null => {
      const flowPt = screenToFlowPosition({ x: clientX, y: clientY });
      const all = useCanvasStore.getState().nodes;
      // 倒序遍历，靠后的 group（z 高）优先
      for (let i = all.length - 1; i >= 0; i--) {
        const g = all[i];
        if (g.type !== "group") continue;
        const w =
          (g.measured?.width ?? (g.width as number | undefined) ?? 0) || 0;
        const h =
          (g.measured?.height ?? (g.height as number | undefined) ?? 0) || 0;
        if (!w || !h) continue;
        if (
          flowPt.x >= g.position.x &&
          flowPt.x <= g.position.x + w &&
          flowPt.y >= g.position.y &&
          flowPt.y <= g.position.y + h
        ) {
          return g.id;
        }
      }
      return null;
    },
    [screenToFlowPosition],
  );

  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: { id: string; type?: string }) => {
      isNodeDraggingRef.current = true;
      setIsNodeDragging(true);
      setCanvasGeometryDragging(true);
      setCanvasDraggingNodeId(node.id);
      setSnapGuides([]);
      lastSnapGuideKeyRef.current = "";
      if (enableDragSnapGuides && node.type !== "group") {
        const all = getNodes() as CanvasFlowNode[];
        snapOthersRef.current = all
          .filter((n) => n.id !== node.id && n.type !== "group")
          .map((n) => nodeSnapBox(n, all));
      } else {
        snapOthersRef.current = [];
      }
      if (dragUndoPausedRef.current) return;
      useCanvasStore.temporal.getState().pause();
      dragUndoPausedRef.current = true;
    },
    [enableDragSnapGuides, getNodes, setCanvasGeometryDragging, setCanvasDraggingNodeId],
  );

  const onNodeDrag = useCallback(
    (event: React.MouseEvent, node: { id: string; type?: string }) => {
      const clientX = event.clientX;
      const clientY = event.clientY;
      if (dragHoverRafRef.current === null) {
        dragHoverRafRef.current = window.requestAnimationFrame(() => {
          dragHoverRafRef.current = null;
          if (node.type === "group") return;
          const gid = findGroupAtPoint(clientX, clientY);
          const cur = useCanvasStore.getState().dragHoverGroupId;
          if (gid !== cur) setDragHoverGroup(gid);
        });
      }

      // 拖动中只画参考线，不改节点坐标（避免与 RF 内置拖动打架）
      if (!enableDragSnapGuides || node.type === "group") return;
      if (dragSnapRafRef.current !== null) return;
      dragSnapRafRef.current = window.requestAnimationFrame(() => {
        dragSnapRafRef.current = null;
        const all = getNodes() as CanvasFlowNode[];
        const dragging = all.find((n) => n.id === node.id);
        if (!dragging) return;
        const dragBox = nodeSnapBox(dragging, all);
        const nearby = filterNearbySnapCandidates(
          dragBox,
          snapOthersRef.current,
        );
        const { guides } = computeDragSnap(dragBox, nearby);
        const key = snapGuideKey(guides);
        if (key === lastSnapGuideKeyRef.current) return;
        lastSnapGuideKeyRef.current = key;
        setSnapGuides(guides);
      });
    },
    [enableDragSnapGuides, findGroupAtPoint, getNodes, setDragHoverGroup],
  );

  const flushAutosaveAfterDrag = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("canvas:flush-autosave"));
  }, []);

  const commitFlowPositionsFromRf = useCallback(() => {
    const rf = getNodes();
    const storeNodes = useCanvasStore.getState().nodes;
    const patches = rf
      .filter((rfN) => {
        const sn = storeNodes.find((n) => n.id === rfN.id);
        if (!sn) return false;
        return (
          sn.position.x !== rfN.position.x || sn.position.y !== rfN.position.y
        );
      })
      .map((n) => ({ id: n.id, position: n.position }));
    if (!patches.length) return false;
    useCanvasStore.getState().commitFlowNodePositions(patches);
    return true;
  }, [getNodes]);

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: { id: string; type?: string; parentId?: string }) => {
      isNodeDraggingRef.current = false;
      setIsNodeDragging(false);
      setCanvasGeometryDragging(false);
      setCanvasDraggingNodeId(null);
      setSnapGuides([]);
      if (dragUndoPausedRef.current) {
        useCanvasStore.temporal.getState().resume();
        dragUndoPausedRef.current = false;
      }
      if (node.type === "group") {
        deferStoreGraphSyncRef.current = false;
        setDragHoverGroup(null);
        return;
      }
      if (enableDragSnapGuides) {
        const all = getNodes() as CanvasFlowNode[];
        const dragging = all.find((n) => n.id === node.id);
        if (dragging) {
          const dragBox = nodeSnapBox(dragging, all);
          const nearby = filterNearbySnapCandidates(
            dragBox,
            snapOthersRef.current,
          );
          const { dx, dy } = computeDragSnap(dragBox, nearby);
          if (dx !== 0 || dy !== 0) {
            const snapped = applyDragSnapToNode(dragging, all, dx, dy);
            setRfNodes((prev) =>
              prev.map((n) =>
                n.id === node.id ? { ...n, position: snapped.position } : n,
              ),
            );
          }
        }
      }
      const didCommitPositions = commitFlowPositionsFromRf();
      const gid = findGroupAtPoint(event.clientX, event.clientY);
      const willReparent = gid !== (node.parentId ?? null);
      if (willReparent) {
        // 进 / 出 / 换组
        reparentNode(node.id, gid);
      }
      setDragHoverGroup(null);
      if (libtvCanvas && node.type && node.type !== "group") {
        setRfNodes((prev) =>
          prev.map((n) => ({ ...n, selected: n.id === node.id })),
        );
        useCanvasStore.getState().setLibtvFloatingDockSelection(
          node.id,
          node.type,
        );
      }
      deferStoreGraphSyncRef.current = false;
      if (didCommitPositions || willReparent) {
        flushAutosaveAfterDrag();
      }
    },
    [
      commitFlowPositionsFromRf,
      enableDragSnapGuides,
      findGroupAtPoint,
      flushAutosaveAfterDrag,
      getNodes,
      libtvCanvas,
      reparentNode,
      setDragHoverGroup,
      setRfNodes,
      setCanvasGeometryDragging,
    ],
  );

  const onConnectStart = useCallback(
    (_evt: unknown, params: { nodeId?: string | null }) => {
      setConnectingFrom(params.nodeId ?? null);
    },
    [setConnectingFrom],
  );
  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      const clientX =
        "changedTouches" in event
          ? event.changedTouches[0]?.clientX
          : event.clientX;
      const clientY =
        "changedTouches" in event
          ? event.changedTouches[0]?.clientY
          : event.clientY;

      if (connectionState.isValid) {
        setConnectingFrom(null);
        return;
      }

      if (clientX == null || clientY == null) {
        setConnectingFrom(null);
        return;
      }

      const flowPoint = screenToFlowPosition({ x: clientX, y: clientY });
      const nodes = getNodes() as CanvasFlowNode[];
      const snapped = resolveSnapConnectionOnNodeHit(
        {
          isValid: connectionState.isValid ?? undefined,
          fromNodeId: connectionState.fromNode?.id,
          fromHandleId: connectionState.fromHandle?.id,
          fromHandleType: connectionState.fromHandle?.type,
          toNodeId: connectionState.toNode?.id,
          toHandleId: connectionState.toHandle?.id,
        },
        nodes,
        flowPoint,
      );
      if (snapped) {
        onConnect(snapped);
        setConnectingFrom(null);
        return;
      }

      const fromNodeId = connectionState.fromNode?.id;
      const fromHandleId = connectionState.fromHandle?.id;
      const fromNodeType = connectionState.fromNode?.type;
      const fromHandleType = connectionState.fromHandle?.type;
      if (
        fromNodeId &&
        fromHandleId &&
        fromNodeType &&
        fromHandleType &&
        isLibtvSidePlusConnectHandle(String(fromNodeType), fromHandleId) &&
        resolveLibtvSideConnectMenu(
          String(fromNodeType),
          fromHandleId,
          connectionState.fromNode?.data as Record<string, unknown> | undefined,
        )
      ) {
        useCanvasStore.getState().setPendingSideConnect({
          anchor: { x: clientX, y: clientY },
          fromNodeId,
          fromHandleId,
          fromHandleType,
        });
        return;
      }

      setConnectingFrom(null);
    },
    [setConnectingFrom, screenToFlowPosition, getNodes, onConnect],
  );

  // 媒体组 zIndex 随选中变化；在 RF 本地完成，不触发 zustand
  const rfNodesForRender = useMemo(
    () => syncPro2MediaGroupZIndex(rfNodes),
    [rfNodes],
  );

  // 分组拖入高亮：仅 patch 目标 group，避免每帧克隆全图 nodes
  const decoratedNodes = useMemo(() => {
    if (!dragHoverGroupId) return rfNodesForRender;
    return rfNodesForRender.map((n) =>
      n.id === dragHoverGroupId
        ? {
            ...n,
            className: `${n.className ?? ""} is-drop-target`.trim(),
          }
        : n,
    );
  }, [rfNodesForRender, dragHoverGroupId]);

  const EDGE_FOCUS_MAX = 48;

  /** 选中单个节点 → 高亮其上游(入)/下游(出)连线并流动，其余淡化（拖动中关闭以保性能） */
  const focusEdgeIds = useMemo(() => {
    if (isNodeDragging) return null;
    if (rfEdges.length > EDGE_FOCUS_MAX) return null;
    const sel = rfNodes.filter((n) => n.selected);
    if (sel.length !== 1) return null;
    const node = sel[0];
    const ids = new Set<string>([node.id]);
    let parentId = node.parentId;
    while (parentId) {
      ids.add(parentId);
      const parent = rfNodes.find((n) => n.id === parentId);
      parentId = parent?.parentId;
    }
    if (node.type === "group") {
      for (const c of rfNodes) {
        if (c.parentId === node.id) ids.add(c.id);
      }
    }
    return ids;
  }, [rfNodes, isNodeDragging, rfEdges.length]);

  const decoratedEdges = useMemo(() => {
    if (!focusEdgeIds) return rfEdges;
    let changed = false;
    const next = rfEdges.map((e) => {
      if (focusEdgeIds.has(e.target)) {
        const className = `${e.className ?? ""} pro2-edge-active pro2-edge-up`.trim();
        if (
          e.zIndex === 1 &&
          className === e.className &&
          e.style?.stroke === "#60a5fa"
        ) {
          return e;
        }
        changed = true;
        return {
          ...e,
          zIndex: 1,
          className,
          style: { ...(e.style ?? {}), stroke: "#60a5fa", strokeWidth: 1.5 },
        };
      }
      if (focusEdgeIds.has(e.source)) {
        const className =
          `${e.className ?? ""} pro2-edge-active pro2-edge-down`.trim();
        if (
          e.zIndex === 1 &&
          className === e.className &&
          e.style?.stroke === "#238636"
        ) {
          return e;
        }
        changed = true;
        return {
          ...e,
          zIndex: 1,
          className,
          style: { ...(e.style ?? {}), stroke: "#238636", strokeWidth: 1.5 },
        };
      }
      const opacity = (e.style as { opacity?: number } | undefined)?.opacity;
      if (opacity === 0.18) return e;
      changed = true;
      return {
        ...e,
        style: { ...(e.style ?? {}), opacity: 0.18 },
      };
    });
    return changed ? next : rfEdges;
  }, [rfEdges, focusEdgeIds]);

  const onlyRenderVisible =
    forceOnlyRenderVisible || libtvCanvas || rfNodes.length >= 8;

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      const assetDrag = parseProjectAssetDragPayload(event.dataTransfer);
      if (assetDrag) {
        event.preventDefault();
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const ok = await insertProjectAssetViaCanvasBridge(
          assetDrag.assetId,
          position,
        );
        if (ok) return;
      }

      const palette = event.dataTransfer.getData("application/canvas-node-type");
      const droppedImages = allImageFilesFromDataTransfer(event.dataTransfer);
      if (!palette && droppedImages.length > 0) {
        event.preventDefault();
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        await Promise.all(
          droppedImages.map((f, i) =>
            ingestImageFile(
              f,
              { x: position.x + i * 28, y: position.y + i * 28 },
              droppedImages.length === 1 ? "拖入的图片" : `拖入 ${i + 1}`,
            ),
          ),
        );
        return;
      }
      event.preventDefault();
      const presetId = event.dataTransfer.getData(
        "application/canvas-node-preset",
      );
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (palette) {
        const initialData =
          palette === "text" && presetId
            ? buildTextNodeDataFromPreset(presetId)
            : palette === "image-engine" && presetId
              ? buildImageEngineDataFromPreset(presetId)
              : undefined;
        addNode(palette as CanvasNodeType, position, initialData);
        return;
      }

      const files = allImageFilesFromDataTransfer(event.dataTransfer);
      await Promise.all(
        files.map((f, i) =>
          ingestImageFile(
            f,
            { x: position.x + i * 28, y: position.y + i * 28 },
            files.length === 1 ? "拖入的图片" : `拖入 ${i + 1}`,
          ),
        ),
      );
    },
    [addNode, ingestImageFile, screenToFlowPosition],
  );

  // ── 复制 / 剪切 / 粘贴：节点 + 图片
  const copySelectedToClipboard = useCallback((cut: boolean) => {
    const all = getNodes() as CanvasFlowNode[];
    const allEdges = useCanvasStore.getState().edges;
    const selectedNodes = all.filter((n) => n.selected && n.type !== "group");
    if (selectedNodes.length === 0) return false;
    const ids = new Set(selectedNodes.map((n) => n.id));
    const selectedEdges = allEdges.filter(
      (e) => ids.has(e.source) && ids.has(e.target),
    );
    const origin = selectedNodes.reduce(
      (acc, n) => ({
        x: Math.min(acc.x, n.position.x),
        y: Math.min(acc.y, n.position.y),
      }),
      { x: Infinity, y: Infinity },
    );
    const payload: NodeClipboard = {
      nodes: selectedNodes.map((n) => ({
        id: n.id,
        type: n.type,
        data: { ...(n.data as Record<string, unknown>) },
        position: { x: n.position.x, y: n.position.y },
      })),
      edges: selectedEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
      })),
      origin,
    };
    try {
      sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(payload));
    } catch {
      // sessionStorage 写失败（隐身模式等）：忽略
    }
    if (cut) {
      // 仅删节点（边由 React Flow 自动清理）
      setNodes((ns) => ns.filter((n) => !ids.has(n.id)));
      setEdges((es) =>
        es.filter((e) => !ids.has(e.source) && !ids.has(e.target)),
      );
    }
    return true;
  }, [getNodes, setNodes, setEdges]);

  const pasteFromClipboard = useCallback(
    (atFlowPoint?: { x: number; y: number }) => {
      let raw: string | null = null;
      try {
        raw = sessionStorage.getItem(CLIPBOARD_KEY);
      } catch {
        return false;
      }
      if (!raw) return false;
      let payload: NodeClipboard;
      try {
        payload = JSON.parse(raw) as NodeClipboard;
      } catch {
        return false;
      }
      if (!payload.nodes?.length) return false;

      // 落位：粘贴到鼠标位置（如果有），否则距离原位置 +40 偏移
      const baseShift = atFlowPoint
        ? { x: atFlowPoint.x - payload.origin.x, y: atFlowPoint.y - payload.origin.y }
        : { x: 40, y: 40 };

      const idMap = new Map<string, string>();
      for (const n of payload.nodes) {
        const newId = addNode(
          (n.type ?? "text") as CanvasNodeType,
          {
            x: n.position.x + baseShift.x,
            y: n.position.y + baseShift.y,
          },
          { ...cloneCanvasNodeData(n.data as Record<string, unknown>) },
        );
        idMap.set(n.id, newId);
      }
      // 重建边（仅保留两端都被复制的）
      if (payload.edges.length) {
        setEdges((es) => [
          ...es,
          ...payload.edges
            .filter((e) => idMap.has(e.source) && idMap.has(e.target))
            .map((e, i) => ({
              id: `e_${idMap.get(e.source)!}_${idMap.get(e.target)!}_${Date.now()}_${i}`,
              source: idMap.get(e.source)!,
              target: idMap.get(e.target)!,
              sourceHandle: e.sourceHandle,
              targetHandle: e.targetHandle,
              animated: false,
            })),
        ]);
      }
      return true;
    },
    [addNode, setEdges],
  );

  /** 全局 paste：图片优先；其次走节点剪贴板。 */
  useEffect(() => {
    const onPaste = async (event: ClipboardEvent) => {
      if (event.defaultPrevented) return;
      const dt = event.clipboardData;
      // 不在此处规范化：保留剪贴板「原始字节」交给下游上传（与点击上传一致，
      // 服务端 sharp 统一处理）。提前 canvas 重编码会丢色彩配置导致变暗、并多一次有损往返。
      // 预览用的规范化由 ingestImageFile / onFile 各自完成。
      let imageFiles = allImageFilesFromDataTransfer(dt);
      if (!imageFiles.length) {
        imageFiles = await resolveClipboardImageFiles(dt);
      }

      // 文本输入中（含 Dock 粘贴区 contenteditable）不抢图片粘贴，避免粘贴文案时误生图节点
      if (isEditablePasteTarget(event.target)) {
        return;
      }

      if (imageFiles.length > 0) {
        const pointerPaste = pickPointerImagePasteHandler();
        if (pointerPaste) {
          pointerPaste(imageFiles[0]!);
          event.preventDefault();
          return;
        }
        if (await routeClipboardImageToActivePasteSlot(dt, event.target)) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        const ptr = getLastPointerClient();
        const wrap = wrapRef.current;
        const rect = wrap?.getBoundingClientRect?.();
        const pointerInWrap = Boolean(
          rect &&
            ptr.x >= rect.left &&
            ptr.x <= rect.right &&
            ptr.y >= rect.top &&
            ptr.y <= rect.bottom,
        );
        const clientX = pointerInWrap
          ? ptr.x
          : rect
            ? rect.left + rect.width / 2
            : 0;
        const clientY = pointerInWrap
          ? ptr.y
          : rect
            ? rect.top + rect.height / 2
            : 0;
        const center = rect
          ? screenToFlowPosition({ x: clientX, y: clientY })
          : { x: 240, y: 160 };
        await Promise.all(
          imageFiles.map((f, i) =>
            ingestImageFile(
              f,
              { x: center.x + i * 28, y: center.y + i * 28 },
              imageFiles.length === 1 ? "粘贴的图片" : `粘贴 ${i + 1}`,
            ),
          ),
        );
        return;
      }

      // 2) 节点剪贴板（来自 Cmd+C/X）
      const wrap = wrapRef.current;
      const center =
        wrap && wrap.getBoundingClientRect
          ? screenToFlowPosition({
              x: wrap.getBoundingClientRect().left + wrap.clientWidth / 2,
              y: wrap.getBoundingClientRect().top + wrap.clientHeight / 2,
            })
          : undefined;
      const pasted = pasteFromClipboard(center);
      if (pasted) event.preventDefault();
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [ingestImageFile, pasteFromClipboard, screenToFlowPosition]);

  /** Cmd+C / Cmd+X：选中节点入剪贴板。 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (t?.isContentEditable) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "c" || k === "x") {
        const textSel = window.getSelection()?.toString().trim();
        if (textSel) return;
        const did = copySelectedToClipboard(k === "x");
        if (did) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copySelectedToClipboard]);

  const memoNodeTypes = useMemo(() => memoizedNodeTypes, []);
  const memoEdgeTypes = useMemo(() => edgeTypes, []);

  return (
    <div
      ref={wrapRef}
      className={`canvas-flow-wrap relative z-0 h-full w-full overscroll-none ${connectingFromNodeId ? "canvas-connecting" : ""}${sbv1Canvas ? " sbv1-canvas" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onWheelCapture={onCanvasWheelCapture}
    >
      <ReactFlow
        key={projectId}
        nodes={decoratedNodes}
        edges={decoratedEdges}
        nodeTypes={memoNodeTypes}
        edgeTypes={memoEdgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        defaultViewport={viewport}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
        onInit={onInit}
        onSelectionEnd={
          pro2FloatingInspector
            ? () => {
                // 框选松手后会紧跟一次 onPaneClick；忽略以免清空刚选中的节点
                ignoreNextPaneClickRef.current = true;
              }
            : undefined
        }
        onPaneClick={
          pro2FloatingInspector || sbv1Canvas
            ? () => {
                closePaneMenu();
                if (ignoreNextPaneClickRef.current) {
                  ignoreNextPaneClickRef.current = false;
                  return;
                }
                closePaneAddMenu();
                const active = document.activeElement;
                if (active instanceof HTMLElement) {
                  active.blur();
                }
                useCanvasStore
                  .getState()
                  .setLibtvFloatingDockSelection(null, null);
                if (pro2FloatingInspector) {
                  useCanvasStore.getState().setPro2FrameDockFocus(null);
                }
                setRfNodes((prev) =>
                  prev.map((n) => (n.selected ? { ...n, selected: false } : n)),
                );
                window.dispatchEvent(new CustomEvent("canvas:pro2-pane-click"));
              }
            : undefined
        }
        onPaneContextMenu={
          enablePaneContextMenu ? onPaneContextMenu : undefined
        }
        onlyRenderVisibleElements={onlyRenderVisible}
        selectNodesOnDrag
        zoomOnDoubleClick={enablePaneContextMenu ? false : undefined}
        onNodeClick={
          pro2FloatingInspector
            ? (_e, node) => {
                if (node.type !== "group") return;
                const all = useCanvasStore.getState().nodes as CanvasFlowNode[];
                const hit = all.find((n) => n.id === node.id);
                if (!hit || !isPro2StyledGroup(hit, all)) return;
                setRfNodes((prev) =>
                  prev.map((n) => ({ ...n, selected: n.id === node.id })),
                );
              }
            : undefined
        }
        onNodeDoubleClick={
          pro2FloatingInspector
            ? (_e, node) => {
                if (node.type === "story-pro2-starter") {
                  const d = node.data as StoryProStarterNodeData;
                  if (!d.generatedOutlineMd?.trim()) return;
                  if (
                    d.themeOutlineRuntime?.status === "pending" ||
                    d.themeOutlineRuntime?.status === "running"
                  ) {
                    return;
                  }
                  openPro2TextOutlineEditor(node.id);
                  return;
                }
                if (node.type === "story-pro2-script-hub") {
                  const d = node.data as StoryProScriptHubNodeData;
                  const hasScript = pro2HubHasScriptTable(d);
                  const hasCharacter = pro2HubHasCharacterTable(d);
                  const hasOutline = pro2HubHasOutlineContent(d);
                  if (!hasScript && !hasCharacter && !hasOutline) return;
                  openPro2ScriptTableEditor(
                    node.id,
                    hasScript ? "script" : hasCharacter ? "character" : "outline",
                  );
                }
              }
            : undefined
        }
        elevateNodesOnSelect={false}
        autoPanOnNodeDrag={false}
        proOptions={{ hideAttribution: true }}
        className="bg-[var(--canvas-bg)]"
        // 框选：拖空白即可框选；按住 Space 或 中键/右键 拖动来平移
        selectionOnDrag
        panOnDrag={[1, 2]}
        panActivationKeyCode="Space"
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode={["Meta", "Shift", "Control"]}
        // 删除键：选中 edge / node 后可删除（Mac 用 Backspace 也支持）
        deleteKeyCode={["Backspace", "Delete"]}
        // 视口：滚轮平移；Ctrl+滚轮缩放；textarea/select 无 nowheel，滚轮仍平移画布
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={false}
        zoomActivationKeyCode="Control"
        noWheelClassName="nowheel"
        noDragClassName="nodrag"
        minZoom={0.02}
        maxZoom={32}
        connectionRadius={100}
        connectOnClick={false}
        connectionLineStyle={{ strokeWidth: 1, stroke: "#60a5fa" }}
      >
        {/* 淡淡的网格线（大格）+ 细点阵（小格），叠出层次但不抢眼 */}
        <Background
          id="canvas-grid-lines"
          variant={BackgroundVariant.Lines}
          gap={120}
          lineWidth={1}
          color="rgba(255,255,255,0.04)"
        />
        <Background
          id="canvas-grid-dots"
          gap={24}
          size={1}
          color="rgba(255,255,255,0.06)"
        />
        {enableDragSnapGuides ? (
          <CanvasSnapGuidesOverlay guides={snapGuides} />
        ) : null}
        <CanvasViewportToolbar
          pro2Canvas={pro2FloatingInspector}
          sbv1Canvas={sbv1Canvas}
        />
        {pro2FloatingInspector ? (
          <>
            <Pro2SelectionToolbar rfNodes={rfNodes} />
            <Pro2MediaGroupToolbar rfNodes={rfNodes} />
          </>
        ) : null}
        {pro2FloatingInspector || sbv1Canvas ? (
          <Pro2SelectionBatchConnectLayer rfNodes={rfNodes} />
        ) : null}
        <LibtvSideConnectLayer />
      </ReactFlow>
      {pro2FloatingInspector ? null : <SelectionToolbar />}
      {pro2FloatingInspector || sbv1Canvas ? (
        <Sbv1MediaGroupToolbar rfNodes={rfNodes} />
      ) : null}
      {pro2FloatingInspector ? (
        <>
          <Pro2StarterInputDock />
          <Pro2ScriptInputDock />
          <Pro2FrameCellInputDock />
          <Pro2ThreeViewInputDock />
          <Pro2FloatingInspector />
          <Pro2TextNodeOutlineEditorHost />
          <Pro2ScriptTableEditorHost />
        </>
      ) : null}
      {pro2FloatingInspector || sbv1Canvas ? <LibtvImageInputDock /> : null}
      {pro2FloatingInspector || sbv1Canvas ? (
        <Sbv1VideoEngineFloatingDock />
      ) : null}
      <CanvasPaneContextMenu
        open={Boolean(paneMenu)}
        position={paneMenu ?? { x: 0, y: 0 }}
        items={paneMenuItems}
        onClose={closePaneMenu}
      />
      <Pro2AddNodePopover
        open={Boolean(paneAddMenu)}
        anchor={paneAddMenu ?? { x: 0, y: 0 }}
        sections={PRO2_TOOLBAR_ADD_MENU}
        onClose={closePaneAddMenu}
        onPick={onPaneAddPick}
      />
    </div>
  );
}

/** 撤销 / 重做 / 删除 / 复制 快捷键 */
function HotkeyBridge({
  onUndo,
  onRedo,
}: {
  onUndo: () => void;
  onRedo: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        onUndo();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        (e.shiftKey ? e.key.toLowerCase() === "z" : e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        onRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onUndo, onRedo]);
  return null;
}

export function FlowCanvas({
  projectId,
  onUndo,
  onRedo,
  forceOnlyRenderVisible = false,
  pro2FloatingInspector = false,
  sbv1Canvas = false,
}: {
  projectId: string;
  onUndo: () => void;
  onRedo: () => void;
  forceOnlyRenderVisible?: boolean;
  pro2FloatingInspector?: boolean;
  sbv1Canvas?: boolean;
}) {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <HotkeyBridge onUndo={onUndo} onRedo={onRedo} />
        <FlowCanvasInner
          projectId={projectId}
          forceOnlyRenderVisible={forceOnlyRenderVisible}
          pro2FloatingInspector={pro2FloatingInspector}
          sbv1Canvas={sbv1Canvas}
        />
        <CanvasBackgroundVideoPanel projectId={projectId} />
      </ReactFlowProvider>
    </div>
  );
}
