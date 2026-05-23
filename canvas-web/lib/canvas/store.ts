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
  isGroupNode,
} from "./types";
import { migrateGraphV1ToV2 } from "./migrate";

type CanvasState = {
  projectId: string | null;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  viewport: Viewport;

  /**
   * 瞬时态（不进 undo 栈、不进图保存）：
   * - `connectingFromNodeId`：用户按住源 handle 拖线时该 handle 所属节点
   * - `dragHoverGroupId`：拖动节点过程中，鼠标当前悬停在哪个 group 容器内
   */
  connectingFromNodeId: string | null;
  dragHoverGroupId: string | null;
  setConnectingFrom: (id: string | null) => void;
  setDragHoverGroup: (id: string | null) => void;

  hydrate: (projectId: string, graph: CanvasGraph | undefined) => void;
  toGraph: () => CanvasGraph;

  setNodes: (updater: (n: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (updater: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  setViewport: (v: Viewport) => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;

  addNode: (type: CanvasNodeType, position: { x: number; y: number }, data?: Record<string, unknown>) => string;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  setNodeRuntime: (id: string, runtime: Partial<CanvasNodeRuntime>) => void;
  /** 程序化调整节点尺寸（选中时仍可用 NodeResizer 手动覆盖） */
  resizeNode: (id: string, size: { width: number; height: number }) => void;
  removeNode: (id: string) => void;
  duplicateNode: (id: string) => string | null;

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
};

function emptyGraph(): CanvasGraph {
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export const useCanvasStore = create<CanvasState>()(
  temporal(
    (set, get) => ({
      projectId: null,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      connectingFromNodeId: null,
      dragHoverGroupId: null,
      setConnectingFrom: (id) => set({ connectingFromNodeId: id }),
      setDragHoverGroup: (id) => set({ dragHoverGroupId: id }),

      hydrate: (projectId, graph) => {
        const raw = graph && Array.isArray(graph.nodes) ? graph : emptyGraph();
        const g = migrateGraphV1ToV2(raw);
        set({
          projectId,
          nodes: g.nodes as CanvasFlowNode[],
          edges: g.edges as CanvasFlowEdge[],
          viewport: g.viewport ?? { x: 0, y: 0, zoom: 1 },
        });
      },

      toGraph: () => {
        const s = get();
        return {
          schemaVersion: CANVAS_SCHEMA_VERSION,
          nodes: s.nodes,
          edges: s.edges,
          viewport: s.viewport,
        };
      },

      setNodes: (updater) => set({ nodes: updater(get().nodes) }),
      setEdges: (updater) => set({ edges: updater(get().edges) }),
      setViewport: (v) => set({ viewport: v }),

      onNodesChange: (changes) => {
        const prev = get().nodes;
        const manualIds = new Set<string>();
        for (const ch of changes) {
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
        let next = applyNodeChanges(changes, prev) as CanvasFlowNode[];
        if (manualIds.size > 0) {
          next = next.map((n) =>
            manualIds.has(n.id)
              ? { ...n, data: { ...n.data, manualSize: true } }
              : n,
          );
        }
        set({ nodes: next });
      },
      onEdgesChange: (changes) =>
        set({ edges: applyEdgeChanges(changes, get().edges) }),
      onConnect: (connection) => {
        if (!connection.source || !connection.target) return;
        const id = `e_${connection.source}_${connection.target}_${Date.now()}`;
        const newEdge: Edge = {
          id,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
          animated: false,
        };
        set({ edges: [...get().edges, newEdge] });
      },

      addNode: (type, position, data) => {
        const id = `n_${nanoid(8)}`;
        const initialData = {
          ...(NODE_DEFAULT_DATA[type] ?? {}),
          ...(data ?? {}),
          __t: type,
        };
        const size = NODE_DEFAULT_SIZE[type] ?? { width: 320, height: 240 };
        const node: CanvasFlowNode = {
          id,
          type,
          position,
          data: initialData,
          // 给 NodeResizer 提供初始 width / height；用户拖角调整后会被 React Flow 覆盖
          style: { width: size.width, height: size.height },
        };
        set({ nodes: [...get().nodes, node] });
        return id;
      },

      updateNodeData: (id, patch) => {
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
          ),
        });
      },

      setNodeRuntime: (id, runtime) => {
        set({
          nodes: get().nodes.map((n) => {
            if (n.id !== id) return n;
            // group 容器没有 runtime 字段，直接跳过
            if (isGroupNode(n.type)) return n;
            const data = n.data as Record<string, unknown> & {
              runtime?: CanvasNodeRuntime;
            };
            const prev = data.runtime ?? { status: "idle" as const };
            return {
              ...n,
              data: { ...n.data, runtime: { ...prev, ...runtime } },
            };
          }),
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
        set({
          nodes: get().nodes.filter((n) => n.id !== id),
          edges: get().edges.filter((e) => e.source !== id && e.target !== id),
        });
      },

      duplicateNode: (id) => {
        const src = get().nodes.find((n) => n.id === id);
        if (!src) return null;
        const newId = `n_${nanoid(8)}`;
        set({
          nodes: [
            ...get().nodes,
            {
              ...src,
              id: newId,
              position: { x: src.position.x + 40, y: src.position.y + 40 },
              data: { ...src.data, runtime: undefined },
            },
          ],
        });
        return newId;
      },

      createGroupContaining: (childIds, { label, color, measuredSizes }) => {
        const all = get().nodes;
        const children = all.filter(
          (n) => childIds.includes(n.id) && !isGroupNode(n.type),
        );
        if (children.length === 0) return null;

        // 递归绝对坐标（为后续支持嵌套组留余地）
        const absOf = (n: CanvasFlowNode): { x: number; y: number } => {
          if (!n.parentId) return n.position;
          const p = all.find((x) => x.id === n.parentId);
          if (!p) return n.position;
          const pa = absOf(p);
          return { x: pa.x + n.position.x, y: pa.y + n.position.y };
        };

        const PADDING = 28;
        const HEADER = 32;
        const boxes = children.map((c) => {
          const m = measuredSizes?.[c.id];
          // 优先信任 RF 实测尺寸；其次 zustand 节点的 measured；最后才用宽松 fallback
          const w =
            m?.w ??
            c.measured?.width ??
            (c.width as number | undefined) ??
            240;
          const h =
            m?.h ??
            c.measured?.height ??
            (c.height as number | undefined) ??
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
        const groupW = maxX - minX + PADDING * 2;
        const groupH = maxY - minY + PADDING * 2 + HEADER;

        const groupNode: CanvasFlowNode = {
          id: groupId,
          type: "group",
          position: { x: groupX, y: groupY },
          data: { __t: "group", label, color },
          width: groupW,
          height: groupH,
          style: { width: groupW, height: groupH },
          selectable: true,
          draggable: true,
          // Group 排在最前面（zIndex 较低）才能让子节点叠在上面渲染
          zIndex: -1,
        } as CanvasFlowNode;

        const childIdSet = new Set(childIds);
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
            } as CanvasFlowNode);
          } else if (n.id !== groupId) {
            newNodes.push(n);
          }
        }
        set({ nodes: newNodes });
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
        set({ nodes: next });
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
        const groups = updated.filter((n) => isGroupNode(n.type));
        const others = updated.filter((n) => !isGroupNode(n.type));
        set({ nodes: [...groups, ...others], dragHoverGroupId: null });
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
