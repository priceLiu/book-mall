"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  MiniMap,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import type { CanvasNodeType } from "@/lib/canvas/types";
import { buildTextNodeDataFromPreset } from "@/lib/canvas/text-templates";
import { buildImageEngineDataFromPreset } from "@/lib/canvas/image-engine-presets";
import { uploadCanvasImage } from "@/lib/canvas-api";
import {
  registerCanvasViewportPlacement,
  unregisterCanvasViewportPlacement,
} from "@/lib/canvas/viewport-placement";
import { onCanvasWheelCapture } from "@/lib/canvas/canvas-form-wheel";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import { ImageNode } from "./nodes/image-node";
import { TextNode } from "./nodes/text-node";
import { AiEngineNode } from "./nodes/ai-engine-node";
import { ImageEngineNode } from "./nodes/image-engine-node";
import { ThreeViewEngineNode } from "./nodes/three-view-engine-node";
import { StoryComicStarterNode } from "./nodes/story-comic-starter-node";
import { StoryScriptHubNode } from "./nodes/story-script-hub-node";
import { StoryCharacterColumnNode } from "./nodes/story-character-column-node";
import { StoryFrameColumnNode } from "./nodes/story-frame-column-node";
import { StoryVideoColumnNode } from "./nodes/story-video-column-node";
import { MdPreviewNode } from "./nodes/md-preview-node";
import { VideoEngineNode } from "./nodes/video-engine-node";
import { TtsEngineNode } from "./nodes/tts-engine-node";
import { AudioPreviewNode } from "./nodes/audio-preview-node";
import { ImagePreviewNode } from "./nodes/image-preview-node";
import { VideoPreviewNode } from "./nodes/video-preview-node";
import { JianyingExportNode } from "./nodes/jianying-export-node";
import { StoryProStarterNode } from "./nodes/story-pro-starter-node";
import { StoryProScriptHubNode } from "./nodes/story-pro-script-hub-node";
import { StoryProStyleNode } from "./nodes/story-pro-style-node";
import { StoryProSceneColumnNode } from "./nodes/story-pro-scene-column-node";
import { JianyingExportProNode } from "./nodes/jianying-export-pro-node";
import { RefImageGridNode } from "./nodes/ref-image-grid-node";
import { AiVideoEngineNode } from "./nodes/ai-video-engine-node";
import { VideoGenerateNode } from "./nodes/video-generate-node";
import { OutputNode } from "./nodes/output-node";
import { GroupNode } from "./nodes/group-node";
import { SelectionToolbar } from "./selection-toolbar";
import { DeletableEdge } from "./edges/deletable-edge";

// v2 节点：v1 (`ai-text` / `image-gen` / `product-params`) 已被 `migrateGraphV1ToV2`
// 在 store hydrate 时改写为 v2 type，所以 React Flow 这里只需要注册新的 type。
const nodeTypes = {
  image: ImageNode,
  text: TextNode,
  "story-comic-starter": StoryComicStarterNode,
  "ai-engine": AiEngineNode,
  "image-engine": ImageEngineNode,
  "three-view-engine": ThreeViewEngineNode,
  "story-script-hub": StoryScriptHubNode,
  "story-character-column": StoryCharacterColumnNode,
  "story-frame-column": StoryFrameColumnNode,
  "story-video-column": StoryVideoColumnNode,
  "video-engine": VideoEngineNode,
  "ref-grid-4": RefImageGridNode,
  "ref-grid-6": RefImageGridNode,
  "ref-grid-9": RefImageGridNode,
  "ai-video-engine": AiVideoEngineNode,
  "video-generate": VideoGenerateNode,
  "tts-engine": TtsEngineNode,
  "md-preview": MdPreviewNode,
  "audio-preview": AudioPreviewNode,
  "video-preview": VideoPreviewNode,
  "image-preview": ImagePreviewNode,
  "jianying-export": JianyingExportNode,
  "story-pro-starter": StoryProStarterNode,
  "story-pro-script-hub": StoryProScriptHubNode,
  "story-pro-style": StoryProStyleNode,
  "story-pro-scene": StoryProSceneColumnNode,
  "story-pro-character": StoryCharacterColumnNode,
  "story-pro-frame": StoryFrameColumnNode,
  "story-pro-video": StoryVideoColumnNode,
  "jianying-export-pro": JianyingExportProNode,
  output: OutputNode,
  group: GroupNode,
} as const;

const edgeTypes = {
  default: DeletableEdge,
} as const;

export const canvasFlowNodeTypes = nodeTypes;
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

function FlowCanvasInner({ projectId }: { projectId: string }) {
  const base = useBookMallBaseUrl();
  const wrapRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const initialFitDoneRef = useRef(false);

  const nodes = useCanvasStore((s) => s.nodes);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const addNode = useCanvasStore((s) => s.addNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const setConnectingFrom = useCanvasStore((s) => s.setConnectingFrom);
  const dragHoverGroupId = useCanvasStore((s) => s.dragHoverGroupId);
  const setDragHoverGroup = useCanvasStore((s) => s.setDragHoverGroup);
  const reparentNode = useCanvasStore((s) => s.reparentNode);
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);
  const fitViewNonce = useCanvasStore((s) => s.fitViewNonce);

  useEffect(() => {
    initialFitDoneRef.current = false;
  }, [projectId]);

  /** 勿用受控 viewport：节点轮询会频繁重渲染，store 里的旧视口会把滚轮缩放拉回 */
  const onMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, vp: Viewport) => {
      setViewport(vp);
    },
    [setViewport],
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
    }
  }, [fitView]);

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
      const id = addNode("image", position, {
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
    [addNode, base, updateNodeData],
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

  const onNodeDrag = useCallback(
    (event: React.MouseEvent, node: { id: string; type?: string }) => {
      if (node.type === "group") return;
      const gid = findGroupAtPoint(event.clientX, event.clientY);
      const cur = useCanvasStore.getState().dragHoverGroupId;
      if (gid !== cur) setDragHoverGroup(gid);
    },
    [findGroupAtPoint, setDragHoverGroup],
  );

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: { id: string; type?: string; parentId?: string }) => {
      if (node.type === "group") {
        setDragHoverGroup(null);
        return;
      }
      const gid = findGroupAtPoint(event.clientX, event.clientY);
      if (gid !== (node.parentId ?? null)) {
        // 进 / 出 / 换组
        reparentNode(node.id, gid);
      }
      setDragHoverGroup(null);
    },
    [findGroupAtPoint, reparentNode, setDragHoverGroup],
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

  // 把 dragHoverGroupId 注入对应 group 节点的 className（不改 store nodes）
  const decoratedNodes = useMemo(() => {
    if (!dragHoverGroupId) return nodes;
    return nodes.map((n) =>
      n.id === dragHoverGroupId
        ? { ...n, className: `${n.className ?? ""} is-drop-target`.trim() }
        : n,
    );
  }, [nodes, dragHoverGroupId]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const palette = event.dataTransfer.getData("application/canvas-node-type");
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

      const files = Array.from(event.dataTransfer.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      await Promise.all(
        files.map((f, i) =>
          ingestImageFile(f, {
            x: position.x + i * 24,
            y: position.y + i * 24,
          }),
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
      const t = event.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      if (t?.isContentEditable) return;

      // 1) 图片：从 clipboardData.files / .items 拿
      const files: File[] = [];
      const dt = event.clipboardData;
      if (dt) {
        if (dt.files && dt.files.length > 0) {
          for (const f of Array.from(dt.files)) {
            if (f.type.startsWith("image/")) files.push(f);
          }
        }
        if (files.length === 0 && dt.items) {
          for (const item of Array.from(dt.items)) {
            if (item.kind === "file" && item.type.startsWith("image/")) {
              const f = item.getAsFile();
              if (f) files.push(f);
            }
          }
        }
      }
      if (files.length > 0) {
        event.preventDefault();
        // 视口中心放第一个，后续依次偏移
        const wrap = wrapRef.current;
        const center =
          wrap && wrap.getBoundingClientRect
            ? screenToFlowPosition({
                x: wrap.getBoundingClientRect().left + wrap.clientWidth / 2,
                y: wrap.getBoundingClientRect().top + wrap.clientHeight / 2,
              })
            : { x: 240, y: 160 };
        await Promise.all(
          files.map((f, i) =>
            ingestImageFile(
              f,
              { x: center.x + i * 24, y: center.y + i * 24 },
              files.length === 1 ? "粘贴的图片" : `粘贴 ${i + 1}`,
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

  const memoNodeTypes = useMemo(() => nodeTypes, []);
  const memoEdgeTypes = useMemo(() => edgeTypes, []);

  return (
    <div
      ref={wrapRef}
      className={`canvas-flow-wrap relative z-0 h-full w-full overscroll-none ${connectingFromNodeId ? "canvas-connecting" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onWheelCapture={onCanvasWheelCapture}
    >
      <ReactFlow
        key={projectId}
        nodes={decoratedNodes}
        edges={edges}
        nodeTypes={memoNodeTypes}
        edgeTypes={memoEdgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        defaultViewport={viewport}
        onMoveEnd={onMoveEnd}
        onInit={onInit}
        proOptions={{ hideAttribution: true }}
        className="bg-[var(--canvas-bg)]"
        // 框选：拖空白即可框选；按住 Space 或 中键/右键 拖动来平移
        selectionOnDrag
        panOnDrag={[1, 2]}
        panActivationKeyCode="Space"
        nodeDragHandle={`.${RF_NODE_DRAG_HANDLE}`}
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
        minZoom={0.1}
        maxZoom={2.5}
      >
        <Background gap={24} size={1} color="rgba(255,255,255,0.06)" />
        <MiniMap
          pannable
          zoomable
          nodeColor={() => "rgba(167,139,250,0.6)"}
          maskColor="rgba(11,11,20,0.8)"
          className="!bg-[var(--canvas-surface)] !border !border-white/10 !rounded-md"
        />
      </ReactFlow>
      <SelectionToolbar />
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
}: {
  projectId: string;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <ReactFlowProvider>
      <HotkeyBridge onUndo={onUndo} onRedo={onRedo} />
      <FlowCanvasInner projectId={projectId} />
    </ReactFlowProvider>
  );
}
