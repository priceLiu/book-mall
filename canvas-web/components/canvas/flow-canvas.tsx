"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  MiniMap,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeChange,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { isCanvasInteractiveGeometryInProgress } from "@/lib/canvas/canvas-node-changes";
import { isPro2StyledGroup } from "@/lib/canvas/pro2-media-group-meta";
import type {
  CanvasFlowEdge,
  CanvasFlowNode,
  CanvasNodeType,
} from "@/lib/canvas/types";
import { buildTextNodeDataFromPreset } from "@/lib/canvas/text-templates";
import { buildImageEngineDataFromPreset } from "@/lib/canvas/image-engine-presets";
import { uploadCanvasImage } from "@/lib/canvas-api";
import {
  registerCanvasViewportPlacement,
  unregisterCanvasViewportPlacement,
} from "@/lib/canvas/viewport-placement";
import { ensureNodeDragHandles } from "@/lib/canvas/normalize-graph-nodes";
import { onCanvasWheelCapture } from "@/lib/canvas/canvas-form-wheel";
import {
  allImageFilesFromDataTransfer,
  isEditablePasteTarget,
  getLastPointerClient,
  isImagePasteSlotTarget,
  pickPointerImagePasteHandler,
  routeClipboardImageToActivePasteSlot,
} from "@/lib/canvas/image-upload-handlers";
import { memoizedNodeTypes } from "./memoized-node-types";
import { SelectionToolbar } from "./selection-toolbar";
import { Pro2FloatingInspector } from "./pro2/pro2-floating-inspector";
import { Pro2FrameCellInputDock } from "./pro2/pro2-frame-cell-input-dock";
import { Pro2MediaGroupToolbar } from "./pro2/pro2-media-group-toolbar";
import { Pro2SelectionToolbar } from "./pro2/pro2-selection-toolbar";
import { Pro2StarterInputDock } from "./pro2/pro2-starter-input-dock";
import { Pro2ScriptInputDock } from "./pro2/pro2-script-input-dock";
import { Pro2ImageInputDock } from "./pro2/pro2-image-input-dock";
import { Sbv1MediaGroupToolbar } from "./sbv1/sbv1-media-group-toolbar";
import { Sbv1VideoEngineFloatingDock } from "./sbv1/sbv1-video-engine-floating-dock";
import { Sbv1ImageInputDock } from "./sbv1/sbv1-image-input-dock";
import { Pro2ThreeViewInputDock } from "./pro2/pro2-three-view-input-dock";
import { Pro2TextNodeOutlineEditorHost } from "./pro2/pro2-text-node-outline-editor-host";
import { Pro2ScriptTableEditorHost } from "./pro2/pro2-script-table-editor-host";
import type {
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
} from "@/lib/canvas/story-pro-workspace-types";
import {
  pro2HubHasCharacterTable,
  pro2HubHasScriptTable,
} from "@/lib/canvas/pro2-script-hub-helpers";
import { DeletableEdge } from "./edges/deletable-edge";

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
  const dragUndoPausedRef = useRef(false);
  const ignoreNextPaneClickRef = useRef(false);
  const [isNodeDragging, setIsNodeDragging] = useState(false);
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

  useEffect(() => {
    initialFitDoneRef.current = false;
    const s = useCanvasStore.getState();
    setRfNodes(ensureNodeDragHandles(s.nodes));
    setRfEdges(s.edges);
  }, [projectId, setRfNodes, setRfEdges]);

  /** Zustand → RF 本地：hydrate / undo / 拖放结束等；拖动过程中跳过避免双写 */
  useEffect(() => {
    const unsub = useCanvasStore.subscribe((state, prev) => {
      if (deferStoreGraphSyncRef.current) return;
      if (state.nodes !== prev.nodes) {
        setRfNodes(ensureNodeDragHandles(state.nodes));
      }
      if (state.edges !== prev.edges) {
        setRfEdges(state.edges);
      }
    });
    return unsub;
  }, [setRfNodes, setRfEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      // 始终只更新本地 RF 状态 → 拖动每帧只重绘被拖节点，画面流畅
      onRfNodesChange(changes);
      if (isCanvasInteractiveGeometryInProgress(changes)) {
        // 拖动 / 缩放过程中不写 zustand：避免每帧触发所有订阅 s.nodes 的节点重渲染
        // 终态（dragging:false / resizing:false）会在松手那帧落库
        deferStoreGraphSyncRef.current = true;
        return;
      }
      deferStoreGraphSyncRef.current = false;
      storeOnNodesChange(changes);
    },
    [onRfNodesChange, storeOnNodesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof storeOnEdgesChange>[0]) => {
      onRfEdgesChange(changes);
      storeOnEdgesChange(changes);
    },
    [onRfEdgesChange, storeOnEdgesChange],
  );

  /** 勿用受控 viewport：节点轮询会频繁重渲染，store 里的旧视口会把滚轮缩放拉回 */
  const onMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, vp: Viewport) => {
      if (viewportTimerRef.current !== null) {
        window.clearTimeout(viewportTimerRef.current);
      }
      viewportTimerRef.current = window.setTimeout(() => {
        setViewport(vp);
        viewportTimerRef.current = null;
      }, 350);
    },
    [setViewport],
  );

  useEffect(
    () => () => {
      if (viewportTimerRef.current !== null) {
        window.clearTimeout(viewportTimerRef.current);
      }
      if (dragHoverRafRef.current !== null) {
        window.cancelAnimationFrame(dragHoverRafRef.current);
      }
    },
    [],
  );

  const onInit = useCallback(() => {
    if (initialFitDoneRef.current) return;
    initialFitDoneRef.current = true;
    const vp = useCanvasStore.getState().viewport;
    const laid = useCanvasStore.getState().nodes;
    if (laid.length === 0) return;
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

  /** 上传一个图片 File，并在指定位置创建 image 节点。返回新节点 id。 */
  const ingestImageFile = useCallback(
    async (
      file: File,
      position: { x: number; y: number },
      labelOverride?: string,
    ) => {
      const blobUrl = URL.createObjectURL(file);
      const imageType: CanvasNodeType = sbv1Canvas
        ? "sbv1-image"
        : pro2FloatingInspector
          ? "story-pro2-image"
          : "image";
      const id = addNode(imageType, position, {
        blobUrl,
        uploading: true,
        label: labelOverride ?? file.name ?? "粘贴的图片",
      });
      try {
        const ossUrl = await uploadCanvasImage(base, file);
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

  const onNodeDragStart = useCallback(() => {
    setIsNodeDragging(true);
    if (dragUndoPausedRef.current) return;
    useCanvasStore.temporal.getState().pause();
    dragUndoPausedRef.current = true;
  }, []);

  const onNodeDrag = useCallback(
    (event: React.MouseEvent, node: { id: string; type?: string }) => {
      if (node.type === "group") return;
      const clientX = event.clientX;
      const clientY = event.clientY;
      if (dragHoverRafRef.current !== null) return;
      dragHoverRafRef.current = window.requestAnimationFrame(() => {
        dragHoverRafRef.current = null;
        const gid = findGroupAtPoint(clientX, clientY);
        const cur = useCanvasStore.getState().dragHoverGroupId;
        if (gid !== cur) setDragHoverGroup(gid);
      });
    },
    [findGroupAtPoint, setDragHoverGroup],
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
      setIsNodeDragging(false);
      deferStoreGraphSyncRef.current = false;
      if (dragUndoPausedRef.current) {
        useCanvasStore.temporal.getState().resume();
        dragUndoPausedRef.current = false;
      }
      if (node.type === "group") {
        setDragHoverGroup(null);
        return;
      }
      const didCommitPositions = commitFlowPositionsFromRf();
      const gid = findGroupAtPoint(event.clientX, event.clientY);
      const willReparent = gid !== (node.parentId ?? null);
      if (willReparent) {
        // 进 / 出 / 换组
        reparentNode(node.id, gid);
      }
      setDragHoverGroup(null);
      if (didCommitPositions || willReparent) {
        flushAutosaveAfterDrag();
      }
    },
    [
      commitFlowPositionsFromRf,
      findGroupAtPoint,
      flushAutosaveAfterDrag,
      reparentNode,
      setDragHoverGroup,
    ],
  );

  const onConnectStart = useCallback(
    (_evt: unknown, params: { nodeId?: string | null }) => {
      setConnectingFrom(params.nodeId ?? null);
    },
    [setConnectingFrom],
  );
  const onConnectEnd = useCallback(() => {
    setConnectingFrom(null);
  }, [setConnectingFrom]);

  // 分组拖入高亮：仅 patch 目标 group，避免每帧克隆全图 nodes
  const decoratedNodes = useMemo(() => {
    if (!dragHoverGroupId) return rfNodes;
    return rfNodes.map((n) =>
      n.id === dragHoverGroupId
        ? {
            ...n,
            className: `${n.className ?? ""} is-drop-target`.trim(),
          }
        : n,
    );
  }, [rfNodes, dragHoverGroupId]);

  /** 选中单个节点 → 高亮其上游(入)/下游(出)连线并流动，其余淡化（拖动中关闭以保性能） */
  const focusEdgeIds = useMemo(() => {
    if (isNodeDragging) return null;
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
  }, [rfNodes, isNodeDragging]);

  const decoratedEdges = useMemo(() => {
    if (!focusEdgeIds) return rfEdges;
    return rfEdges.map((e) => {
      if (focusEdgeIds.has(e.target)) {
        return {
          ...e,
          zIndex: 1000,
          className: `${e.className ?? ""} pro2-edge-active pro2-edge-up`.trim(),
          style: { ...(e.style ?? {}), stroke: "#60a5fa", strokeWidth: 2.5 },
        };
      }
      if (focusEdgeIds.has(e.source)) {
        return {
          ...e,
          zIndex: 1000,
          className: `${e.className ?? ""} pro2-edge-active pro2-edge-down`.trim(),
          style: { ...(e.style ?? {}), stroke: "#a78bfa", strokeWidth: 2.5 },
        };
      }
      return {
        ...e,
        style: { ...(e.style ?? {}), opacity: 0.18 },
      };
    });
  }, [rfEdges, focusEdgeIds]);

  const onlyRenderVisible = forceOnlyRenderVisible || rfNodes.length >= 12;
  const showMiniMap = rfNodes.length <= 48;

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
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
    const all = useCanvasStore.getState().nodes;
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
  }, [setNodes, setEdges]);

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
          { ...n.data },
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
      const t = event.target as HTMLElement | null;
      const dt = event.clipboardData;
      const imageFiles = allImageFilesFromDataTransfer(dt);

      if (
        t &&
        /^(INPUT|TEXTAREA)$/.test(t.tagName) &&
        !imageFiles.length
      ) {
        return;
      }
      if (t?.isContentEditable && !imageFiles.length) return;

      if (imageFiles.length > 0) {
        const inDockZone = isImagePasteSlotTarget(event.target);
        const inEditable =
          isEditablePasteTarget(event.target) && !inDockZone;
        if (!inEditable) {
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
          pro2FloatingInspector
            ? () => {
                if (ignoreNextPaneClickRef.current) {
                  ignoreNextPaneClickRef.current = false;
                  return;
                }
                useCanvasStore.getState().setPro2FrameDockFocus(null);
                setNodes((prev) =>
                  prev.map((n) => (n.selected ? { ...n, selected: false } : n)),
                );
              }
            : undefined
        }
        onlyRenderVisibleElements={onlyRenderVisible}
        selectNodesOnDrag
        zoomOnDoubleClick={pro2FloatingInspector ? false : undefined}
        onNodeClick={
          pro2FloatingInspector
            ? (_e, node) => {
                if (node.type !== "group") return;
                const all = useCanvasStore.getState().nodes as CanvasFlowNode[];
                const hit = all.find((n) => n.id === node.id);
                if (!hit || !isPro2StyledGroup(hit, all)) return;
                setNodes((prev) =>
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
                  if (!hasScript && !hasCharacter) return;
                  openPro2ScriptTableEditor(
                    node.id,
                    hasScript ? "script" : "character",
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
        connectionRadius={30}
        connectOnClick={false}
      >
        <Background gap={24} size={1} color="rgba(255,255,255,0.06)" />
        {showMiniMap ? (
          <MiniMap
            pannable
            zoomable
            nodeColor={() => "rgba(167,139,250,0.6)"}
            maskColor="rgba(11,11,20,0.8)"
            className="!bg-[var(--canvas-surface)] !border !border-white/10 !rounded-md"
          />
        ) : null}
        {pro2FloatingInspector ? (
          <>
            <Pro2SelectionToolbar rfNodes={rfNodes} />
            <Pro2MediaGroupToolbar rfNodes={rfNodes} />
          </>
        ) : null}
      </ReactFlow>
      {pro2FloatingInspector ? null : <SelectionToolbar />}
      {sbv1Canvas ? <Sbv1MediaGroupToolbar rfNodes={rfNodes} /> : null}
      {pro2FloatingInspector ? (
        <>
          <Pro2StarterInputDock />
          <Pro2ScriptInputDock />
          <Pro2FrameCellInputDock />
          <Pro2ImageInputDock />
          <Pro2ThreeViewInputDock />
          <Pro2FloatingInspector />
          <Pro2TextNodeOutlineEditorHost />
          <Pro2ScriptTableEditorHost />
        </>
      ) : null}
      {sbv1Canvas ? <Sbv1ImageInputDock /> : null}
      {sbv1Canvas ? <Sbv1VideoEngineFloatingDock /> : null}
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
      </ReactFlowProvider>
    </div>
  );
}
