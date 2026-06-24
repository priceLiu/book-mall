"use client";

import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type Viewport,
} from "@xyflow/react";
import dagre from "dagre";
import { nanoid } from "nanoid";
import { create } from "zustand";
import { temporal } from "zundo";
import type {
  CanvasFlowEdge,
  CanvasFlowNode,
  CanvasGraph,
  CanvasNodeData,
  CanvasNodeRuntime,
  CanvasNodeType,
} from "./types";
import {
  CANVAS_SCHEMA_VERSION,
  NODE_DEFAULT_DATA,
  NODE_DEFAULT_SIZE,
  STORY_FRAME_IMAGE_ENGINE_SIZE,
  isGroupNode,
  isStoryWorkspaceNodeType,
} from "./types";
import {
  duplicateCanvasNodeData,
  isolateSharedCanvasNodeData,
  mergeCanvasNodeInitialData,
} from "./clone-node-data";
import { migrateGraphV1ToV2 } from "./migrate";
import {
  detachChildrenOfRemovedGroups,
  ensureNodeDragHandles,
  normalizeCanvasNodes,
  reflowStoryTemplateGroups as reflowStoryTemplateGroupsOnNodes,
  sortNodesForReactFlow,
  stripPersistedNodeSelection,
} from "./normalize-graph-nodes";
import { reflowStoryComicFlat } from "./story-comic-layout";
import { reflowStoryComicColumns } from "./story-comic-columns-layout";
import {
  finalizeStoryMediaGraph,
  reconcileStoryVideoColumnRows,
} from "./story-column-display";
import { applyStoryColumnHeights, isStoryMediaColumnType } from "./story-column-layout";
import { canAddStoryNodeType } from "./story-edition-isolation";
import { normalizePro2PlusLeftConnection } from "./pro2-side-plus-connect";
import {
  expandSbv1GroupOutMediaConnection,
  normalizeSbv1PlusLeftConnection,
} from "./sbv1-side-plus-connect";
import {
  inferPro2MediaGroupKind,
  pro2MediaGroupDefaultLabel,
  syncPro2MediaGroupZIndex,
} from "./pro2-media-group-meta";
import {
  applyPro2MediaGroupRelayout,
  PRO2_MEDIA_GROUP_HEADER,
  PRO2_MEDIA_GROUP_PAD,
  pro2MediaChildSize,
} from "./pro2-media-group-layout";
import { applySbv1MediaGroupRelayout } from "./sbv1-media-group-layout";
import { reflowSbv1Canvas as computeSbv1CanvasReflow } from "./sbv1-canvas-layout";
import { reflowPro2CanvasLayout } from "./pro2-canvas-layout";
import { duplicateMediaGroupInGraph } from "./duplicate-media-group";
import { hasStoryComicPipeline } from "./story-comic-layout";
import { reflowStoryComicWorkspace } from "./story-comic-workspace-layout";
import {
  hasStoryProPipeline,
  reflowStoryProWorkspace,
} from "./story-pro-workspace-layout";
import {
  hasStoryPro2Pipeline,
  reflowStoryPro2Workspace,
} from "./story-pro2-workspace-layout";
import { reconcileStoryProWorkspace } from "./spawn-story-pro-workspace";
import {
  migratePro2SceneColumnOffCanvas,
} from "./pro2-spawn-scene-image-group";
import { reconcileStoryPro2Workspace } from "./spawn-story-pro2-workspace";
import { canvasNotify } from "./canvas-notify";
import {
  isCanvasInteractiveGeometryInProgress,
  isCanvasSelectionOnlyChange,
  isCanvasDimensionCommitOnly,
  isCanvasPositionCommitOnly,
  syncNodeDimensionsFromChanges,
} from "./canvas-node-changes";

/** 大图 hydrate：列高/媒体同步延后一帧，先出画布 */
const DEFER_HYDRATE_LAYOUT_NODE_COUNT = 24;

function bumpGraphRevision(state: { graphRevision: number }): number {
  return state.graphRevision + 1;
}

/** Dock / prompt 草稿字段：debounce 写 store 时 pause undo，但仍 bump graphRevision 供 autosave */
const CANVAS_DRAFT_DATA_FIELDS = new Set([
  "prompt",
  "dockInput",
  "themeInput",
]);

function isCanvasDraftDataPatch(
  patch: Record<string, unknown>,
  commit?: boolean,
): boolean {
  if (commit === true) return false;
  const keys = Object.keys(patch);
  return keys.length > 0 && keys.every((k) => CANVAS_DRAFT_DATA_FIELDS.has(k));
}

function withGraphRevision<T extends Record<string, unknown>>(
  state: { graphRevision: number },
  patch: T,
): T & { graphRevision: number } {
  return { ...patch, graphRevision: bumpGraphRevision(state) };
}

function finalizeHydratedGraph(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] } {
  const stripped = stripStoryPreviewNodes(nodes, edges);
  let nextNodes = stripped.nodes;
  let nextEdges = stripped.edges;
  nextEdges = repairStoryPreviewEdges(nextNodes, nextEdges);
  const finalized = finalizeStoryMediaGraph(nextNodes, nextEdges);
  nextNodes = applyStoryColumnHeights(finalized.nodes, finalized.edges);
  nextEdges = finalized.edges;
  return {
    nodes: ensureNodeDragHandles(nextNodes),
    edges: nextEdges,
  };
}
import { validateStoryPipelineDeletion } from "./story-pipeline-delete-guard";
import { pruneMentionsAfterNodeRemoval } from "./strip-dock-mentions";
import { reconcileStoryWorkspaceEdges } from "./spawn-story-workspace";
import { hasStoryComicColumnGroups } from "./story-comic-groups";
import {
  repairStoryPreviewEdges,
  stripStoryPreviewNodes,
} from "./story-comic-edges";
import { applyStoryFrameEdgeConnection } from "./story-frame-connect";
import {
  applyRefVideoEdgeConnection,
  validateRefVideoConnection,
} from "./ref-video-edges";
import { validatePro2StyleAssetConnection } from "./pro2-style-asset-connect";
import type { HubPreviewSection } from "./story-hub-runtime";

type CanvasState = {
  projectId: string | null;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  viewport: Viewport;
  /** 递增后触发 React Flow fitView（漫剧重排等） */
  fitViewNonce: number;
  /** 生成中聚焦某节点（选中 + 平移，不写 undo 栈） */
  runningFocusNodeId: string | null;
  runningFocusNonce: number;
  /** 用户从生成记录等入口定位节点（选中 + fitView） */
  canvasFocusNodeId: string | null;
  canvasFocusNonce: number;
  focusCanvasNode: (nodeId: string) => void;
  /** 递增表示 nodes/edges 业务数据变更；纯选中不进栈。坐标松手提交会 bump 以触发 autosave */
  graphRevision: number;

  /**
   * 瞬时态（不进 undo 栈、不进图保存）：
   * - `connectingFromNodeId`：用户按住源 handle 拖线时该 handle 所属节点
   * - `dragHoverGroupId`：拖动节点过程中，鼠标当前悬停在哪个 group 容器内
   */
  connectingFromNodeId: string | null;
  dragHoverGroupId: string | null;
  /** 节点拖动/缩放几何进行中：浮动 Dock 隐藏，松手后恢复 */
  canvasGeometryDragging: boolean;
  /** 当前正在被拖动的节点 id（仅 geometryDragging 时有效） */
  canvasDraggingNodeId: string | null;
  /** 画布 pan/zoom 进行中：浮动 Dock / 内联 @ 缩略图暂停更新 */
  canvasViewportMoving: boolean;
  /** LibTV 浮动 Dock · 最近一次唯一选中节点（zoom 时 RF 选中态可能闪断，Dock 读此字段） */
  libtvFloatingDockNodeId: string | null;
  libtvFloatingDockNodeType: string | null;
  setConnectingFrom: (id: string | null) => void;
  setDragHoverGroup: (id: string | null) => void;
  setCanvasGeometryDragging: (dragging: boolean) => void;
  setCanvasDraggingNodeId: (nodeId: string | null) => void;
  setCanvasViewportMoving: (moving: boolean) => void;
  setLibtvFloatingDockSelection: (
    nodeId: string | null,
    nodeType: string | null,
  ) => void;

  /** 故事大纲审阅弹窗（全局，避免节点重渲染丢失 open 状态） */
  storyHubReview: { hubId: string; section: HubPreviewSection } | null;
  openStoryHubReview: (hubId: string, section: HubPreviewSection) => void;
  closeStoryHubReview: () => void;

  /** 2.0 文本节点 · 故事大纲全屏编辑（双击打开） */
  pro2TextOutlineEditorNodeId: string | null;
  openPro2TextOutlineEditor: (nodeId: string) => void;
  closePro2TextOutlineEditor: () => void;

  /** 2.0 脚本节点 · 角色/分镜全屏编辑（双击打开） */
  pro2ScriptTableEditorNodeId: string | null;
  pro2ScriptTableEditorTab: import("./pro2-script-hub-view-types").Pro2ScriptHubViewTab;
  openPro2ScriptTableEditor: (
    nodeId: string,
    tab?: import("./pro2-script-hub-view-types").Pro2ScriptHubViewTab,
  ) => void;
  setPro2ScriptTableEditorTab: (
    tab: import("./pro2-script-hub-view-types").Pro2ScriptHubViewTab,
  ) => void;
  closePro2ScriptTableEditor: () => void;

  /** 2.0 分镜图板 · 当前聚焦的单格（用于格下输入坞） */
  pro2FrameDockFocus: { nodeId: string; rowKey: string } | null;
  setPro2FrameDockFocus: (
    focus: { nodeId: string; rowKey: string } | null,
  ) => void;

  /** 风格库弹层 · 为指定图片节点套用风格（null = 仅 spawn 模式） */
  pro2StyleLibImageNodeId: string | null;
  setPro2StyleLibImageNodeId: (nodeId: string | null) => void;

  hydrate: (projectId: string, graph: CanvasGraph | undefined) => void;
  toGraph: () => CanvasGraph;

  setNodes: (updater: (n: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (updater: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  setViewport: (v: Viewport) => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;

  addNode: (type: CanvasNodeType, position: { x: number; y: number }, data?: Record<string, unknown>) => string;
  /** 在 group 内一次性创建子节点（避免先 add 再 reparent 触发 RF 父节点缺失）。 */
  addNodeInGroup: (
    type: CanvasNodeType,
    groupId: string,
    relativePosition: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  updateNodeData: (
    id: string,
    patch: Record<string, unknown>,
    options?: { commit?: boolean },
  ) => void;
  setNodeRuntime: (id: string, runtime: Partial<CanvasNodeRuntime>) => void;
  /** 程序化调整节点尺寸（选中时仍可用 NodeResizer 手动覆盖） */
  resizeNode: (id: string, size: { width: number; height: number }) => void;
  removeNode: (id: string) => void;
  duplicateNode: (
    id: string,
    options?: { preserveContent?: boolean },
  ) => string | null;
  /** 复制媒体组（含子节点）并自 hub 再连一条线 */
  duplicateMediaGroup: (groupId: string) => string | null;

  /**
   * 把一组现有节点包进新建的 group 容器（设 parentId + extent='parent'）。
   * 可选传入 `measuredSizes`：来自调用方（通常是 React Flow internal）的真实测量尺寸，
   * key = nodeId，value = { w, h }。这样能避免依赖 zustand 节点身上未必到位的 measured。
   */
  createGroupContaining: (
    childIds: string[],
    args: {
      label: string;
      color: string;
      measuredSizes?: Record<string, { w: number; h: number }>;
      /** 强制走 Pro2 图1 暗色组壳（手动框选打组） */
      pro2Styled?: boolean;
      /** 底部 Dock 快捷预设组：LibTV 壳 + 自定义水平排布 */
      pro2ShortcutPreset?: boolean;
    },
  ) => string | null;
  /** 解散指定 group：把它的子节点 parentNode 清空、坐标恢复到画布坐标。 */
  ungroup: (groupId: string) => void;
  /** 对一组节点子图做 dagre LR 布局。 */
  autoLayoutNodes: (nodeIds: string[]) => void;

  /**
   * 把指定节点重新挂到 newParentGroupId（或挂到画布根，传 null）。
   * 自动换算 position 使屏幕坐标不变；并设置 / 清除 extent='parent'。
   */
  reparentNode: (nodeId: string, newParentGroupId: string | null) => void;
  /** 从 React Flow 本地 nodes 提交坐标（拖动松手兜底；不跑 normalize） */
  commitFlowNodePositions: (
    patches: Array<{ id: string; position: { x: number; y: number } }>,
  ) => void;
  /** 漫剧模板：重排「角色三视图 / 分镜媒体」分组内节点并放大框体（旧版分组画布）。 */
  reflowStoryTemplateGroups: () => void;
  /** 漫剧全链路 · 扁平画布一键重排。 */
  reflowStoryComicLayout: () => void;
  /** 影视 2.0 · 工作区节点按模板重排。 */
  reflowPro2Canvas: () => void;
  /** 分镜视频 1.0 · 媒体组 + 顶层节点重排。 */
  reflowSbv1Canvas: () => void;
};

function emptyGraph(): CanvasGraph {
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function defaultNodeSize(
  type: CanvasNodeType,
  data?: Record<string, unknown>,
): { width: number; height: number } {
  if (type === "image-engine" && typeof data?.frameIndex === "number") {
    return STORY_FRAME_IMAGE_ENGINE_SIZE;
  }
  return NODE_DEFAULT_SIZE[type] ?? { width: 320, height: 240 };
}

export const useCanvasStore = create<CanvasState>()(
  temporal(
    (set, get) => ({
      projectId: null,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      fitViewNonce: 0,
      runningFocusNodeId: null,
      runningFocusNonce: 0,
      canvasFocusNodeId: null,
      canvasFocusNonce: 0,
      graphRevision: 0,
      connectingFromNodeId: null,
      dragHoverGroupId: null,
      canvasGeometryDragging: false,
      canvasDraggingNodeId: null,
      canvasViewportMoving: false,
      libtvFloatingDockNodeId: null,
      libtvFloatingDockNodeType: null,
      setConnectingFrom: (id) => set({ connectingFromNodeId: id }),
      setDragHoverGroup: (id) => set({ dragHoverGroupId: id }),
      setCanvasGeometryDragging: (dragging) =>
        set({ canvasGeometryDragging: dragging }),
      setCanvasDraggingNodeId: (nodeId) =>
        set({ canvasDraggingNodeId: nodeId }),
      setCanvasViewportMoving: (moving) =>
        set({ canvasViewportMoving: moving }),
      setLibtvFloatingDockSelection: (nodeId, nodeType) =>
        set({
          libtvFloatingDockNodeId: nodeId,
          libtvFloatingDockNodeType: nodeType,
        }),

      storyHubReview: null,
      openStoryHubReview: (hubId, section) =>
        set({ storyHubReview: { hubId, section } }),
      closeStoryHubReview: () => set({ storyHubReview: null }),

      pro2TextOutlineEditorNodeId: null,
      openPro2TextOutlineEditor: (nodeId) =>
        set({ pro2TextOutlineEditorNodeId: nodeId }),
      closePro2TextOutlineEditor: () =>
        set({ pro2TextOutlineEditorNodeId: null }),

      pro2ScriptTableEditorNodeId: null,
      pro2ScriptTableEditorTab: "script",
      openPro2ScriptTableEditor: (nodeId, tab = "script") =>
        set({
          pro2ScriptTableEditorNodeId: nodeId,
          pro2ScriptTableEditorTab: tab,
        }),
      setPro2ScriptTableEditorTab: (tab) =>
        set({ pro2ScriptTableEditorTab: tab }),
      closePro2ScriptTableEditor: () =>
        set({
          pro2ScriptTableEditorNodeId: null,
          pro2ScriptTableEditorTab: "script",
        }),

      pro2FrameDockFocus: null,
      setPro2FrameDockFocus: (focus) => set({ pro2FrameDockFocus: focus }),
      pro2StyleLibImageNodeId: null,
      setPro2StyleLibImageNodeId: (nodeId) =>
        set({ pro2StyleLibImageNodeId: nodeId }),

      hydrate: (projectId, graph) => {
        const raw = graph && Array.isArray(graph.nodes) ? graph : emptyGraph();
        const g = migrateGraphV1ToV2(raw);
        let edges = g.edges as CanvasFlowEdge[];
        const migrated = migratePro2SceneColumnOffCanvas(
          g.nodes as CanvasFlowNode[],
          edges,
        );
        edges = migrated.edges;
        let normalized = normalizeCanvasNodes(migrated.nodes, edges);
        let nodes = stripPersistedNodeSelection(
          normalized.some((n) => String(n.type ?? "").startsWith("story-pro2-"))
            ? reconcileStoryPro2Workspace(normalized)
            : reconcileStoryProWorkspace(normalized),
        );
        const viewport = g.viewport ?? { x: 0, y: 0, zoom: 1 };

        const applyDeferredLayout = () => {
          const current = get();
          const laid = finalizeHydratedGraph(current.nodes, current.edges);
          set((state) =>
            withGraphRevision(state, {
              nodes: isolateSharedCanvasNodeData(laid.nodes),
              edges: laid.edges,
            }),
          );
        };

        if (nodes.length >= DEFER_HYDRATE_LAYOUT_NODE_COUNT) {
          set((state) =>
            withGraphRevision(state, {
              projectId,
              nodes: isolateSharedCanvasNodeData(
                ensureNodeDragHandles(nodes),
              ),
              edges,
              viewport,
              storyHubReview: null,
              pro2TextOutlineEditorNodeId: null,
              pro2ScriptTableEditorNodeId: null,
              libtvFloatingDockNodeId: null,
              libtvFloatingDockNodeType: null,
            }),
          );
          queueMicrotask(applyDeferredLayout);
          return;
        }

        const laid = finalizeHydratedGraph(nodes, edges);
        set((state) =>
          withGraphRevision(state, {
            projectId,
            nodes: isolateSharedCanvasNodeData(laid.nodes),
            edges: laid.edges,
            viewport,
            storyHubReview: null,
            pro2TextOutlineEditorNodeId: null,
            pro2ScriptTableEditorNodeId: null,
            libtvFloatingDockNodeId: null,
            libtvFloatingDockNodeType: null,
          }),
        );
      },

      toGraph: () => {
        const s = get();
        return {
          schemaVersion: CANVAS_SCHEMA_VERSION,
          nodes: stripPersistedNodeSelection(s.nodes),
          edges: s.edges,
          viewport: s.viewport,
        };
      },

      setNodes: (updater) => {
        set((state) => {
          const edges = state.edges;
          return withGraphRevision(state, {
            nodes: normalizeCanvasNodes(updater(state.nodes), edges),
          });
        });
      },
      setEdges: (updater) =>
        set((state) =>
          withGraphRevision(state, { edges: updater(state.edges) }),
        ),
      setViewport: (v) => set({ viewport: v }),

      focusCanvasNode: (nodeId) => {
        const all = get().nodes;
        if (!all.some((n) => n.id === nodeId)) return;
        set({
          nodes: all.map((n) => ({
            ...n,
            selected: n.id === nodeId,
          })),
          canvasFocusNodeId: nodeId,
          canvasFocusNonce: get().canvasFocusNonce + 1,
        });
      },

      onNodesChange: (changes) => {
        const prev = get().nodes;
        const edges = get().edges;
        const removeIds = changes
          .filter((c): c is NodeChange & { type: "remove"; id: string } =>
            c.type === "remove" && "id" in c && typeof c.id === "string",
          )
          .map((c) => c.id);
        let filteredChanges = changes;
        if (removeIds.length) {
          const validation = validateStoryPipelineDeletion(
            removeIds,
            prev,
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
          filteredChanges = changes.filter(
            (c) =>
              c.type !== "remove" ||
              ("id" in c && typeof c.id === "string" && allowed.has(c.id)),
          );
        }
        const manualIds = new Set<string>();
        for (const ch of filteredChanges) {
          if (
            ch.type === "dimensions" &&
            "id" in ch &&
            ch.id &&
            "resizing" in ch &&
            ch.resizing === false
          ) {
            manualIds.add(ch.id);
          }
        }
        let next = syncNodeDimensionsFromChanges(
          applyNodeChanges(filteredChanges, prev) as CanvasFlowNode[],
          filteredChanges,
        );
        if (isCanvasSelectionOnlyChange(filteredChanges)) {
          next = syncPro2MediaGroupZIndex(next);
          set({ nodes: next });
          return;
        }
        if (isCanvasInteractiveGeometryInProgress(filteredChanges)) {
          // 拖动/缩放过程中只同步几何，不跑 normalize（避免松手后尺寸回弹）
          set({ nodes: next });
          return;
        }
        if (isCanvasPositionCommitOnly(filteredChanges)) {
          set((state) => withGraphRevision(state, { nodes: next }));
          return;
        }
        const manualSized = new Map<string, CanvasFlowNode>();
        if (manualIds.size > 0) {
          for (const id of manualIds) {
            const hit = next.find((n) => n.id === id);
            if (hit) manualSized.set(id, hit);
          }
          next = next.map((n) =>
            manualIds.has(n.id)
              ? { ...n, data: { ...n.data, manualSize: true } }
              : n,
          );
        }
        if (isCanvasDimensionCommitOnly(filteredChanges, manualIds)) {
          if (manualSized.size > 0) {
            next = next.map((n) => {
              const saved = manualSized.get(n.id);
              if (!saved) return n;
              const style = saved.style as { width?: number; height?: number } | undefined;
              const width = Number(saved.width ?? style?.width) || undefined;
              const height = Number(saved.height ?? style?.height) || undefined;
              if (!width || !height) return n;
              return {
                ...n,
                width,
                height,
                style: {
                  ...(typeof n.style === "object" && n.style ? n.style : {}),
                  width,
                  height,
                },
                data: { ...n.data, manualSize: true },
              } as CanvasFlowNode;
            });
          }
          set((state) => withGraphRevision(state, { nodes: next }));
          return;
        }
        next = detachChildrenOfRemovedGroups(prev, next);
        const removedNodeIds = prev
          .filter((n) => !next.some((x) => x.id === n.id))
          .map((n) => n.id);
        let nextEdges = edges;
        if (removedNodeIds.length > 0) {
          const removedSet = new Set(removedNodeIds);
          nextEdges = edges.filter(
            (e) => !removedSet.has(e.source) && !removedSet.has(e.target),
          );
          for (const removedId of removedNodeIds) {
            next = pruneMentionsAfterNodeRemoval(next, removedId);
          }
        }
        next = normalizeCanvasNodes(next, nextEdges);
        if (next.some((n) => String(n.type ?? "").startsWith("story-pro2-"))) {
          next = reconcileStoryPro2Workspace(next);
        } else if (
          next.some(
            (n) =>
              String(n.type ?? "").startsWith("story-pro-") &&
              !String(n.type ?? "").startsWith("story-pro2-"),
          )
        ) {
          next = reconcileStoryProWorkspace(next);
        }
        if (manualSized.size > 0) {
          next = next.map((n) => {
            const saved = manualSized.get(n.id);
            if (!saved) return n;
            const style = saved.style as { width?: number; height?: number } | undefined;
            const width = Number(saved.width ?? style?.width) || undefined;
            const height = Number(saved.height ?? style?.height) || undefined;
            if (!width || !height) return n;
            return {
              ...n,
              width,
              height,
              style: {
                ...(typeof n.style === "object" && n.style ? n.style : {}),
                width,
                height,
              },
              data: { ...n.data, manualSize: true },
            } as CanvasFlowNode;
          });
        }
        set((state) => {
          const pinned = get().libtvFloatingDockNodeId;
          const clearDockPin =
            pinned && removedNodeIds.includes(pinned)
              ? {
                  libtvFloatingDockNodeId: null,
                  libtvFloatingDockNodeType: null,
                }
              : {};
          const patch: {
            nodes: CanvasFlowNode[];
            edges?: CanvasFlowEdge[];
            libtvFloatingDockNodeId?: null;
            libtvFloatingDockNodeType?: null;
          } = {
            nodes: next,
            ...clearDockPin,
          };
          if (removedNodeIds.length > 0) {
            patch.edges = nextEdges;
          }
          return withGraphRevision(state, patch);
        });
      },
      onEdgesChange: (changes) =>
        set((state) =>
          withGraphRevision(state, {
            edges: applyEdgeChanges(changes, state.edges),
          }),
        ),
      onConnect: (connection) => {
        if (!connection.source || !connection.target) return;
        const state = get();
        const normalized = normalizeSbv1PlusLeftConnection(
          normalizePro2PlusLeftConnection(connection, state.nodes),
          state.nodes,
        );
        const refValidation = validateRefVideoConnection(
          normalized,
          state.nodes,
          state.edges,
        );
        if (!refValidation.ok) {
          console.warn("[canvas] connection rejected:", refValidation.reason);
          return;
        }
        const styleValidation = validatePro2StyleAssetConnection(
          normalized,
          state.nodes,
        );
        if (!styleValidation.ok) {
          console.warn("[canvas] connection rejected:", styleValidation.reason);
          return;
        }

        const groupImageEdges = expandSbv1GroupOutMediaConnection(
          normalized,
          state.nodes,
          state.edges,
        );
        if (groupImageEdges !== null) {
          if (!groupImageEdges.length) {
            console.warn(
              "[canvas] sbv1 group connect skipped: no images in group or already linked",
            );
            return;
          }
          set((state) =>
            withGraphRevision(state, {
              edges: [...state.edges, ...groupImageEdges],
            }),
          );
          return;
        }

        const id = `e_${normalized.source}_${normalized.target}_${Date.now()}`;
        const newEdge: Edge = {
          id,
          source: normalized.source,
          target: normalized.target,
          sourceHandle: normalized.sourceHandle ?? undefined,
          targetHandle: normalized.targetHandle ?? undefined,
          animated: false,
        };
        let edges = [...state.edges, newEdge];
        edges = applyStoryFrameEdgeConnection({
          connection: normalized,
          nodes: state.nodes,
          edges,
          updateNodeData: (nodeId, patch) => get().updateNodeData(nodeId, patch),
        });
        applyRefVideoEdgeConnection({
          connection: normalized,
          nodes: state.nodes,
          updateNodeData: (nodeId, patch) => get().updateNodeData(nodeId, patch),
        });

        const srcNode = state.nodes.find((n) => n.id === normalized.source);
        const tgtNode = state.nodes.find((n) => n.id === normalized.target);
        if (
          srcNode?.type === "story-pro2-starter" &&
          tgtNode?.type === "story-pro2-script-hub"
        ) {
          const sd = srcNode.data as import("./story-pro-workspace-types").StoryProStarterNodeData;
          const hubPatch: Record<string, unknown> = {
            referencedNodeIds: [srcNode.id],
          };
          if (sd.providerId?.trim()) hubPatch.providerId = sd.providerId;
          if (sd.modelKey?.trim()) hubPatch.modelKey = sd.modelKey;
          if (sd.params) hubPatch.params = sd.params;
          const outline =
            sd.generatedOutlineMd?.trim() || sd.uploadedScriptMd?.trim();
          if (outline) hubPatch.outlineMd = outline;
          get().updateNodeData(tgtNode.id, hubPatch);
          get().updateNodeData(srcNode.id, {
            workspaceIds: {
              ...(sd.workspaceIds ?? {}),
              scriptHubId: tgtNode.id,
            },
          });
        }

        set((state) => withGraphRevision(state, { edges }));
      },

      addNode: (type, position, data) => {
        const blocked = canAddStoryNodeType(type, get().nodes);
        if (!blocked.ok) {
          console.warn("[canvas] addNode blocked:", blocked.message);
          return "";
        }
        const id = `n_${nanoid(8)}`;
        const initialData = mergeCanvasNodeInitialData(
          type,
          NODE_DEFAULT_DATA[type],
          data,
        );
        const size = defaultNodeSize(type, data);
        const node: CanvasFlowNode = {
          id,
          type,
          position,
          data: initialData,
          width: size.width,
          height: size.height,
          style: { width: size.width, height: size.height },
        };
        set((state) =>
          withGraphRevision(state, {
            nodes: ensureNodeDragHandles(
              sortNodesForReactFlow([...state.nodes, node]),
            ),
          }),
        );
        return id;
      },

      addNodeInGroup: (type, groupId, relativePosition, data) => {
        const all = get().nodes;
        const group = all.find((n) => n.id === groupId);
        if (!group || !isGroupNode(group.type)) {
          return get().addNode(type, relativePosition, data);
        }
        const id = `n_${nanoid(8)}`;
        const initialData = mergeCanvasNodeInitialData(
          type,
          NODE_DEFAULT_DATA[type],
          data,
        );
        const size = defaultNodeSize(type, data);
        const node: CanvasFlowNode = {
          id,
          type,
          position: relativePosition,
          parentId: groupId,
          extent: "parent",
          data: initialData,
          width: size.width,
          height: size.height,
          style: { width: size.width, height: size.height },
        };
        set((state) =>
          withGraphRevision(state, {
            nodes: ensureNodeDragHandles(sortNodesForReactFlow([...all, node])),
          }),
        );
        return id;
      },

      updateNodeData: (id, patch, options) => {
        const all = get().nodes;
        let nodes = all.map((n) => {
          if (n.id !== id) return n;
          const base = (n.data ?? {}) as Record<string, unknown>;
          return {
            ...n,
            data: { ...structuredClone(base), ...patch },
          };
        });
        if (patch.rows !== undefined) {
          const t = nodes.find((n) => n.id === id)?.type;
          if (isStoryMediaColumnType(t)) {
            const edges = get().edges;
            nodes = applyStoryColumnHeights(
              reconcileStoryVideoColumnRows(nodes, edges),
              edges,
            );
          }
        }
        if (isCanvasDraftDataPatch(patch, options?.commit)) {
          const temporal = useCanvasStore.temporal.getState();
          temporal.pause();
          try {
            // 草稿仍写入 store 并 bump revision，供 autosave 感知；undo 栈在 pause 内不记录
            set((state) => withGraphRevision(state, { nodes }));
          } finally {
            temporal.resume();
          }
          return;
        }
        set((state) => withGraphRevision(state, { nodes }));
      },

      setNodeRuntime: (id, runtime) => {
        const all = get().nodes;
        const target = all.find((n) => n.id === id);
        if (!target || isGroupNode(target.type)) return;
        if (isStoryWorkspaceNodeType(target.type ?? "")) return;

        const data = target.data as Record<string, unknown> & {
          runtime?: CanvasNodeRuntime;
        };
        const prev = data.runtime ?? { status: "idle" as const };
        const next = { ...prev, ...runtime };
        const unchanged =
          prev.status === next.status &&
          prev.taskId === next.taskId &&
          prev.failCode === next.failCode &&
          prev.failMessage === next.failMessage &&
          prev.dismissedFailTaskId === next.dismissedFailTaskId &&
          prev.textOutput === next.textOutput &&
          prev.ossUrl === next.ossUrl &&
          prev.ephemeralUrl === next.ephemeralUrl;
        if (unchanged) return;

        const wasInflight =
          prev.status === "pending" || prev.status === "running";
        const nowInflight =
          next.status === "pending" || next.status === "running";
        const focusNode = nowInflight && !wasInflight;

        set({
          nodes: all.map((n) => {
            if (n.id !== id) {
              return focusNode ? { ...n, selected: false } : n;
            }
            return {
              ...n,
              selected: focusNode ? true : n.selected,
              data: { ...n.data, runtime: next },
            };
          }),
          ...(focusNode
            ? {
                runningFocusNodeId: id,
                runningFocusNonce: get().runningFocusNonce + 1,
              }
            : {}),
        });
      },

      resizeNode: (id, { width, height }) => {
        set({
          nodes: get().nodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  width,
                  height,
                  style: { ...n.style, width, height },
                }
              : n,
          ),
        });
      },

      removeNode: (id) => {
        const validation = validateStoryPipelineDeletion(
          [id],
          get().nodes,
          get().edges,
        );
        if (!validation.ok) {
          canvasNotify({
            title: "无法删除该节点",
            message: validation.message,
            variant: "error",
          });
          return;
        }
        if (!validation.allowedIds.includes(id)) {
          return;
        }
        const edges = get().edges.filter((e) => e.source !== id && e.target !== id);
        const filtered = get().nodes.filter((n) => n.id !== id);
        const pruned = pruneMentionsAfterNodeRemoval(filtered, id);
        const nodes = pruned.some((n) =>
          String(n.type ?? "").startsWith("story-pro2-"),
        )
          ? reconcileStoryPro2Workspace(pruned)
          : reconcileStoryProWorkspace(pruned);
        const s = get();
        const clearDockPin =
          s.libtvFloatingDockNodeId === id
            ? { libtvFloatingDockNodeId: null, libtvFloatingDockNodeType: null }
            : {};
        set((state) => withGraphRevision(state, { nodes, edges, ...clearDockPin }));
      },

      duplicateNode: (id, options) => {
        const src = get().nodes.find((n) => n.id === id);
        if (!src) return null;
        const newId = `n_${nanoid(8)}`;
        const preserveContent = options?.preserveContent === true;
        const data = duplicateCanvasNodeData(
          src.data as Record<string, unknown>,
          preserveContent,
        );
        set((state) =>
          withGraphRevision(state, {
            nodes: ensureNodeDragHandles([
              ...state.nodes,
              {
                ...src,
                id: newId,
                selected: false,
                position: { x: src.position.x + 40, y: src.position.y + 40 },
                data,
              },
            ]),
          }),
        );
        return newId;
      },

      duplicateMediaGroup: (groupId) => {
        const { nodes, edges } = get();
        const result = duplicateMediaGroupInGraph(groupId, nodes, edges);
        if (!result) return null;
        set((state) =>
          withGraphRevision(state, {
            nodes: sortNodesForReactFlow(result.nodes),
            edges: result.edges,
          }),
        );
        return result.newGroupId;
      },

      createGroupContaining: (
        childIds,
        { label, color, measuredSizes, pro2Styled, pro2ShortcutPreset },
      ) => {
        const all = get().nodes;
        const effectiveChildIds = childIds.filter((id) => {
          const n = all.find((x) => x.id === id);
          return n && !isGroupNode(n.type);
        });
        const children = all.filter((n) => effectiveChildIds.includes(n.id));
        if (children.length === 0) return null;

        // 递归绝对坐标（为后续支持嵌套组留余地）
        const absOf = (n: CanvasFlowNode): { x: number; y: number } => {
          if (!n.parentId) return n.position;
          const p = all.find((x) => x.id === n.parentId);
          if (!p) return n.position;
          const pa = absOf(p);
          return { x: pa.x + n.position.x, y: pa.y + n.position.y };
        };

        const pro2Kind = inferPro2MediaGroupKind(all, effectiveChildIds);
        const sbv1OnlyMedia =
          children.length > 0 &&
          children.every(
            (c) => c.type === "sbv1-image" || c.type === "sbv1-video-engine",
          );
        const sbv1Styled = sbv1OnlyMedia;
        const usePro2MediaGrid = Boolean(
          !pro2ShortcutPreset && (pro2Kind || pro2Styled || sbv1Styled),
        );
        const PADDING = usePro2MediaGrid ? PRO2_MEDIA_GROUP_PAD : 28;
        const HEADER = usePro2MediaGrid ? PRO2_MEDIA_GROUP_HEADER : 32;
        const boxes = children.map((c) => {
          const m = measuredSizes?.[c.id];
          const cell = usePro2MediaGrid
            ? pro2MediaChildSize({
                type: c.type,
                pro2MediaRole: (c.data as { pro2MediaRole?: string })
                  .pro2MediaRole,
              })
            : null;
          // 优先信任 RF 实测尺寸；Pro2 媒体组用标准宫格单元尺寸
          const w =
            m?.w ??
            c.measured?.width ??
            (c.width as number | undefined) ??
            cell?.width ??
            240;
          const h =
            m?.h ??
            c.measured?.height ??
            (c.height as number | undefined) ??
            cell?.height ??
            200;
          const a = absOf(c);
          return { x: a.x, y: a.y, w, h };
        });
        const minX = Math.min(...boxes.map((b) => b.x));
        const minY = Math.min(...boxes.map((b) => b.y));
        const maxX = Math.max(...boxes.map((b) => b.x + b.w));
        const maxY = Math.max(...boxes.map((b) => b.y + b.h));

        const groupId = `g_${nanoid(8)}`;
        const groupX = minX - PADDING;
        const groupY = minY - PADDING - HEADER;
        const groupW = usePro2MediaGrid
          ? 320
          : maxX - minX + PADDING * 2;
        const groupH = usePro2MediaGrid
          ? 240
          : maxY - minY + PADDING * 2 + HEADER;

        const groupData: Record<string, unknown> = {
          __t: "group",
          label: pro2Kind
            ? pro2MediaGroupDefaultLabel(pro2Kind, label)
            : label,
          color,
        };
        if (pro2Kind) {
          groupData.pro2Kind = pro2Kind;
        }
        if (pro2Styled) {
          groupData.pro2Styled = true;
        }
        if (pro2ShortcutPreset) {
          groupData.pro2ShortcutPreset = true;
          groupData.pro2Styled = true;
        }
        if (sbv1Styled) {
          groupData.sbv1Styled = true;
        }

        const groupNode: CanvasFlowNode = {
          id: groupId,
          type: "group",
          position: { x: groupX, y: groupY },
          data: groupData,
          width: groupW,
          height: groupH,
          style: { width: groupW, height: groupH },
          selectable: true,
          draggable: true,
        } as CanvasFlowNode;

        const childIdSet = new Set(effectiveChildIds);
        const newNodes: CanvasFlowNode[] = [];
        // 必须 group 在 children 之前；React Flow 要求父节点先于子节点出现
        newNodes.push(groupNode);
        for (const n of all) {
          if (childIdSet.has(n.id) && !isGroupNode(n.type)) {
            // 把每个子节点改为相对 group 原点的位置（用绝对坐标减 groupX/Y）
            const a = absOf(n);
            newNodes.push({
              ...n,
              parentId: groupId,
              extent: "parent",
              position: { x: a.x - groupX, y: a.y - groupY },
              data: { ...n.data, pro2GroupId: groupId },
            } as CanvasFlowNode);
          } else if (n.id !== groupId) {
            newNodes.push(n);
          }
        }
        let laidOutNodes = newNodes;
        if (usePro2MediaGrid) {
          laidOutNodes = sbv1Styled
            ? applySbv1MediaGroupRelayout(newNodes, get().edges, groupId)
            : applyPro2MediaGroupRelayout(newNodes, groupId);
        }
        set((state) =>
          withGraphRevision(state, {
            nodes: normalizeCanvasNodes(laidOutNodes, state.edges).map((n) => ({
              ...n,
              selected: n.id === groupId,
            })),
          }),
        );
        return groupId;
      },

      ungroup: (groupId) => {
        const all = get().nodes;
        const group = all.find((n) => n.id === groupId);
        if (!group) return;
        const next: CanvasFlowNode[] = [];
        for (const n of all) {
          if (n.id === groupId) continue;
          if (n.parentId === groupId) {
            next.push({
              ...n,
              parentId: undefined,
              extent: undefined,
              position: {
                x: n.position.x + group.position.x,
                y: n.position.y + group.position.y,
              },
            } as CanvasFlowNode);
          } else {
            next.push(n);
          }
        }
        set((state) =>
          withGraphRevision(state, {
            nodes: normalizeCanvasNodes(next, state.edges),
          }),
        );
      },

      autoLayoutNodes: (nodeIds) => {
        const all = get().nodes;
        const idSet = new Set(nodeIds);
        const targets = all.filter(
          (n) => idSet.has(n.id) && !isGroupNode(n.type),
        );
        if (targets.length < 2) return;

        // 先计算每个节点的"绝对画布坐标 + 测量尺寸"
        const sizeOf = (n: CanvasFlowNode) => ({
          w: (n.measured?.width ?? (n.width as number | undefined) ?? 240) as number,
          h: (n.measured?.height ?? (n.height as number | undefined) ?? 140) as number,
        });
        const absOf = (n: CanvasFlowNode): { x: number; y: number } => {
          if (!n.parentId) return n.position;
          const p = all.find((x) => x.id === n.parentId);
          if (!p) return n.position;
          const pa = absOf(p);
          return { x: pa.x + n.position.x, y: pa.y + n.position.y };
        };

        const measured = targets.map((n) => ({
          id: n.id,
          abs: absOf(n),
          ...sizeOf(n),
        }));

        // 跑 dagre LR
        const allEdges = get().edges;
        const subEdges = allEdges.filter(
          (e) => idSet.has(e.source) && idSet.has(e.target),
        );
        const g = new dagre.graphlib.Graph();
        g.setDefaultEdgeLabel(() => ({}));
        g.setGraph({ rankdir: "LR", nodesep: 64, ranksep: 120 });
        for (const m of measured) g.setNode(m.id, { width: m.w, height: m.h });
        for (const e of subEdges) g.setEdge(e.source, e.target);
        dagre.layout(g);

        // 把 dagre 输出（中心坐标）转成左上角，并以"原选区左上角"为锚点平移整体
        const layout = measured.map((m) => {
          const r = g.node(m.id);
          return { id: m.id, x: r.x - m.w / 2, y: r.y - m.h / 2, w: m.w, h: m.h };
        });
        const oldMinX = Math.min(...measured.map((m) => m.abs.x));
        const oldMinY = Math.min(...measured.map((m) => m.abs.y));
        const newMinX = Math.min(...layout.map((l) => l.x));
        const newMinY = Math.min(...layout.map((l) => l.y));
        const dx = oldMinX - newMinX;
        const dy = oldMinY - newMinY;
        const finalAbs = layout.map((l) => ({
          id: l.id,
          x: l.x + dx,
          y: l.y + dy,
          w: l.w,
          h: l.h,
        }));

        // 检查是否所有 target 都属于同一个 group（共享父节点）
        const parentIds = new Set(
          targets.map((n) => n.parentId ?? "__root__"),
        );
        const sharedParentId =
          parentIds.size === 1
            ? targets[0].parentId ?? null
            : null;

        const PADDING = 28;
        const HEADER = 32;

        // 共享 group：把组也按新 bbox 收紧 + 子节点位置改为相对新组原点
        if (sharedParentId) {
          const parent = all.find((p) => p.id === sharedParentId);
          if (parent && isGroupNode(parent.type)) {
            const minX = Math.min(...finalAbs.map((b) => b.x));
            const minY = Math.min(...finalAbs.map((b) => b.y));
            const maxX = Math.max(...finalAbs.map((b) => b.x + b.w));
            const maxY = Math.max(...finalAbs.map((b) => b.y + b.h));
            const newGroupX = minX - PADDING;
            const newGroupY = minY - PADDING - HEADER;
            const newGroupW = maxX - minX + PADDING * 2;
            const newGroupH = maxY - minY + PADDING * 2 + HEADER;

            const updatedGroup: CanvasFlowNode = {
              ...parent,
              position: { x: newGroupX, y: newGroupY },
              width: newGroupW,
              height: newGroupH,
              style: { ...parent.style, width: newGroupW, height: newGroupH },
            } as CanvasFlowNode;

            const relMap = new Map(
              finalAbs.map((b) => [
                b.id,
                { x: b.x - newGroupX, y: b.y - newGroupY },
              ]),
            );

            set({
              nodes: all.map((n) => {
                if (n.id === sharedParentId) return updatedGroup;
                const m = relMap.get(n.id);
                return m ? { ...n, position: m } : n;
              }),
            });
            return;
          }
        }

        // 无共享 group：直接写绝对坐标
        const absMap = new Map(
          finalAbs.map((b) => [b.id, { x: b.x, y: b.y }]),
        );
        set({
          nodes: all.map((n) => {
            const m = absMap.get(n.id);
            return m ? { ...n, position: m } : n;
          }),
        });
      },

      commitFlowNodePositions: (patches) => {
        if (!patches.length) return;
        const byId = new Map(patches.map((p) => [p.id, p.position]));
        set((state) => {
          let changed = false;
          const next = state.nodes.map((n) => {
            const pos = byId.get(n.id);
            if (!pos) return n;
            if (n.position.x === pos.x && n.position.y === pos.y) return n;
            changed = true;
            return { ...n, position: pos };
          });
          if (!changed) return state;
          return withGraphRevision(state, { nodes: next });
        });
      },

      reparentNode: (nodeId, newParentGroupId) => {
        const all = get().nodes;
        const node = all.find((n) => n.id === nodeId);
        if (!node) return;
        if (isGroupNode(node.type)) return; // group 不能嵌套（暂不支持）
        const oldParentId = node.parentId ?? null;
        if (oldParentId === newParentGroupId) return;

        const absOf = (n: CanvasFlowNode): { x: number; y: number } => {
          if (!n.parentId) return n.position;
          const p = all.find((x) => x.id === n.parentId);
          if (!p) return n.position;
          const pa = absOf(p);
          return { x: pa.x + n.position.x, y: pa.y + n.position.y };
        };

        const abs = absOf(node);
        let newPosition = abs;
        if (newParentGroupId) {
          const g = all.find((x) => x.id === newParentGroupId);
          if (!g) return;
          newPosition = { x: abs.x - g.position.x, y: abs.y - g.position.y };
        }

        const updated = all.map((n) =>
          n.id === nodeId
            ? ({
                ...n,
                parentId: newParentGroupId ?? undefined,
                extent: newParentGroupId ? "parent" : undefined,
                position: newPosition,
              } as CanvasFlowNode)
            : n,
        );
        // React Flow 要求父节点先于子节点出现：重排，把所有 group 放最前
        set((state) =>
          withGraphRevision(state, {
            nodes: sortNodesForReactFlow(updated),
            dragHoverGroupId: null,
          }),
        );

        const relayoutGroup = (groupId: string | null) => {
          if (!groupId) return;
          const g = get().nodes.find((n) => n.id === groupId && n.type === "group");
          if (!g) return;
          const kind = (g.data as { pro2Kind?: string }).pro2Kind;
          if (!kind) return;
          set((state) =>
            withGraphRevision(state, {
              nodes: applyPro2MediaGroupRelayout(state.nodes, groupId),
            }),
          );
        };
        relayoutGroup(newParentGroupId);
        relayoutGroup(oldParentId);
      },

      reflowStoryTemplateGroups: () => {
        const { nodes, edges } = get();
        set((state) =>
          withGraphRevision(state, {
            nodes: reflowStoryTemplateGroupsOnNodes(nodes, edges),
          }),
        );
      },

      reflowStoryComicLayout: () => {
        const { nodes, edges } = get();
        const repaired = reconcileStoryWorkspaceEdges(
          nodes,
          repairStoryPreviewEdges(nodes, edges),
        );
        let laid = nodes;
        if (hasStoryComicPipeline(nodes)) {
          const hasWorkspace = nodes.some((n) => n.type === "story-script-hub");
          laid = hasWorkspace
            ? reflowStoryComicWorkspace(nodes, repaired)
            : hasStoryComicColumnGroups(nodes)
              ? reflowStoryComicColumns(nodes, repaired)
              : reflowStoryComicFlat(nodes, repaired);
        }
        if (hasStoryPro2Pipeline(laid)) {
          laid = reflowStoryPro2Workspace(laid, repaired);
        } else if (hasStoryProPipeline(laid)) {
          laid = reflowStoryProWorkspace(laid, repaired);
        }
        set((state) =>
          withGraphRevision(state, {
            nodes: laid,
            edges: repaired,
            fitViewNonce: state.fitViewNonce + 1,
          }),
        );
      },

      reflowPro2Canvas: () => {
        const { nodes, edges } = get();
        const laid = reflowPro2CanvasLayout(nodes, edges);
        set((state) =>
          withGraphRevision(state, {
            nodes: laid,
            fitViewNonce: state.fitViewNonce + 1,
          }),
        );
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("canvas:flush-autosave"));
        }
        canvasNotify({
          title: "画布已重排",
          message: "工作区已归位，媒体组与游离节点已按网格收拢。",
        });
      },

      reflowSbv1Canvas: () => {
        const { nodes, edges } = get();
        const laid = computeSbv1CanvasReflow(nodes, edges);
        set((state) =>
          withGraphRevision(state, {
            nodes: laid,
            fitViewNonce: state.fitViewNonce + 1,
          }),
        );
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("canvas:flush-autosave"));
        }
        canvasNotify({
          title: "画布已重排",
          message: "媒体组与顶层节点已按网格收拢排列。",
        });
      },
    }),
    {
      // 撤销栈：只跟 nodes / edges / viewport 相关字段（避免 hydrate 等动作进栈）
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
      limit: 50,
    },
  ),
);
