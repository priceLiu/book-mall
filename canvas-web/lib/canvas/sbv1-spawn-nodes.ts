"use client";

import {
  absoluteNodePosition,
  ensureNodeDragHandles,
  nodeMeasuredSize,
  sortNodesForReactFlow,
} from "./normalize-graph-nodes";
import {
  SBV1_IMAGE_NODE_WIDTH,
  SBV1_VIDEO_ENGINE_WIDTH,
} from "./sbv1-node-chrome";
import { isSbv1MediaGroup, sbv1ImageChildren } from "./sbv1-media-group-meta";
import { applySbv1MediaGroupRelayout } from "./sbv1-media-group-layout";
import { SBV1_DEFAULT_VIDEO_ENGINE_DATA } from "./sbv1-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";

const GAP = 48;

export function buildSbv1ImageNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    label: "图片",
    dockInput: "",
    ...overrides,
  };
}

export function selectSbv1NodeAfterSpawn(
  setNodes: (
    fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[],
  ) => void,
  nodeId: string,
): void {
  if (!nodeId) return;
  setNodes((prev) =>
    ensureNodeDragHandles(
      sortNodesForReactFlow(
        prev.map((n) => ({ ...n, selected: n.id === nodeId })),
      ),
    ),
  );
}

type SpawnStore = {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type: CanvasNodeType,
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  addNodeInGroup: (
    type: CanvasNodeType,
    groupId: string,
    relativePosition: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
};

function sbv1GroupForNode(
  self: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): CanvasFlowNode | undefined {
  if (!self.parentId) return undefined;
  const group = nodes.find((n) => n.id === self.parentId);
  if (!group || !isSbv1MediaGroup(group, nodes)) return undefined;
  return group;
}

/** 组内节点 spawn 到画布时使用绝对坐标；串联下一视频合成时落到组框右侧外。 */
function sbv1NeighborFlowPosition(
  self: CanvasFlowNode,
  nodes: CanvasFlowNode[],
  side: "left" | "right",
  newNodeW: number,
  nodeType: string,
): { x: number; y: number } {
  const abs = absoluteNodePosition(self, nodes);
  const { w: selfW } = nodeMeasuredSize(self);
  const group = sbv1GroupForNode(self, nodes);

  if (
    group &&
    nodeType === "sbv1-video-engine" &&
    side === "right" &&
    self.type === "sbv1-video-engine"
  ) {
    const gw = group.width ?? SBV1_VIDEO_ENGINE_WIDTH + SBV1_IMAGE_NODE_WIDTH;
    return { x: group.position.x + gw + GAP, y: group.position.y + 40 };
  }

  return {
    x: side === "left" ? abs.x - newNodeW - GAP : abs.x + selfW + GAP,
    y: abs.y,
  };
}

/** 从 sbv1 节点左右 + 生成邻居并连线 */
export function spawnSbv1NeighborFromNode(
  anchorId: string,
  side: "left" | "right",
  nodeType: string,
  store: SpawnStore,
  options?: { spawnMode?: "txt2img" | "img2img"; connectFromAnchor?: boolean },
): string {
  const { nodes, addNode, setNodes, setEdges } = store;
  const self = nodes.find((n) => n.id === anchorId);
  if (!self) return "";

  if (
    nodeType === "sbv1-video-engine" &&
    side === "right" &&
    self.type === "sbv1-image" &&
    self.parentId
  ) {
    const group = nodes.find((n) => n.id === self.parentId);
    if (group && isSbv1MediaGroup(group, nodes)) {
      return spawnSbv1VideoEngineFromGroup(self.parentId, store);
    }
  }

  const newNodeW =
    nodeType === "sbv1-video-engine"
      ? SBV1_VIDEO_ENGINE_WIDTH
      : SBV1_IMAGE_NODE_WIDTH;
  const { x, y } = sbv1NeighborFlowPosition(
    self,
    nodes,
    side,
    newNodeW,
    nodeType,
  );

  if (nodeType === "sbv1-image") {
    const label =
      options?.spawnMode === "txt2img"
        ? "文生图"
        : options?.spawnMode === "img2img"
          ? "图生图"
          : "图片";
    const newId = addNode(
      "sbv1-image",
      { x, y },
      buildSbv1ImageNodeData({
        label,
        imageMode: options?.spawnMode,
      }),
    );
    if (!newId) return "";
    if (self.type === "sbv1-video-engine" && side === "left") {
      setEdges((prev) => [
        ...prev,
        {
          id: `e-${newId}-${anchorId}`,
          source: newId,
          target: anchorId,
          sourceHandle: "image",
          targetHandle: "in_ref",
        },
      ]);
    } else if (self.type === "sbv1-image") {
      const edge =
        side === "left"
          ? {
              id: `e-${newId}-${anchorId}`,
              source: newId,
              target: anchorId,
              sourceHandle: "image",
              targetHandle: "in_image",
            }
          : {
              id: `e-${anchorId}-${newId}`,
              source: anchorId,
              target: newId,
              sourceHandle: "image",
              targetHandle: "in_image",
            };
      setEdges((prev) => [...prev, edge]);
    }
    selectSbv1NodeAfterSpawn(setNodes, newId);
    return newId;
  }

  if (nodeType === "sbv1-video-engine") {
    const newId = addNode("sbv1-video-engine", { x, y }, {
      ...SBV1_DEFAULT_VIDEO_ENGINE_DATA,
    });
    if (!newId) return "";
    const edge =
      self.type === "sbv1-image"
        ? {
            id: `e-${anchorId}-${newId}`,
            source: anchorId,
            target: newId,
            sourceHandle: "image",
            targetHandle: "in_ref",
          }
        : null;
    if (edge) setEdges((prev) => [...prev, edge]);
    selectSbv1NodeAfterSpawn(setNodes, newId);
    return newId;
  }

  return "";
}

/** 分组右侧 + · 生成视频引擎（纳入组内右侧）并接入组内全部 sbv1-image */
export function spawnSbv1VideoEngineFromGroup(
  groupId: string,
  store: SpawnStore,
): string {
  const { nodes, edges, addNodeInGroup, setNodes, setEdges } = store;
  const group = nodes.find((n) => n.id === groupId);
  if (!group) return "";

  const existingEngine = nodes.find(
    (n) =>
      n.parentId === groupId &&
      n.type === "sbv1-video-engine",
  );
  if (existingEngine) {
    selectSbv1NodeAfterSpawn(setNodes, existingEngine.id);
    return existingEngine.id;
  }

  const children = sbv1ImageChildren(groupId, nodes);
  const engineId = addNodeInGroup(
    "sbv1-video-engine",
    groupId,
    { x: 0, y: 0 },
    { ...SBV1_DEFAULT_VIDEO_ENGINE_DATA },
  );
  if (!engineId) return "";

  const newEdges: CanvasFlowEdge[] = children.map((child, i) => ({
    id: `e-${child.id}-${engineId}-${i}`,
    source: child.id,
    target: engineId,
    sourceHandle: "image",
    targetHandle: "in_ref",
    animated: false,
  }));

  const mergedEdges = newEdges.length ? [...edges, ...newEdges] : edges;
  if (newEdges.length) {
    setEdges(() => mergedEdges);
  }

  setNodes((prev) => {
    const laid = applySbv1MediaGroupRelayout(prev, mergedEdges, groupId);
    return ensureNodeDragHandles(
      sortNodesForReactFlow(
        laid.map((n) => ({ ...n, selected: n.id === engineId })),
      ),
    );
  });
  return engineId;
}

export async function handleSbv1ImageSideAddNodePick(
  itemId: string,
  nodeType: string | undefined,
  side: "left" | "right",
  alert: (opts: {
    title: string;
    message: string;
    variant?: "info" | "warning" | "error";
  }) => Promise<void>,
  onSpawnImage: () => void,
  onSpawnVideoCompose?: () => void,
): Promise<void> {
  if (
    itemId === "image" ||
    nodeType === "story-pro2-image" ||
    nodeType === "sbv1-image" ||
    itemId === "txt2img" ||
    itemId === "img2img"
  ) {
    onSpawnImage();
    return;
  }
  if (
    side === "right" &&
    (itemId === "video-compose" ||
      itemId === "video-engine" ||
      nodeType === "sbv1-video-engine")
  ) {
    onSpawnVideoCompose?.();
    return;
  }
  const labels: Record<string, string> = {
    text: "文本节点",
    script: "脚本节点",
    video: "视频节点",
    "three-view": "三视图",
    director: "导演台",
    audio: "音频节点",
    "ref-node": "参考节点",
  };
  await alert({
    title: "即将推出",
    message: labels[itemId]
      ? `「${labels[itemId]}」将在后续版本接入。`
      : "该能力将在后续版本接入。",
    variant: "info",
  });
}

export async function handleSbv1SideAddNodePick(
  itemId: string,
  nodeType: string | undefined,
  alert: (opts: {
    title: string;
    message: string;
    variant?: "info" | "warning" | "error";
  }) => Promise<void>,
  onSpawn: () => void,
): Promise<void> {
  const enabled =
    itemId === "txt2img" ||
    itemId === "img2img" ||
    itemId === "video-engine" ||
    itemId === "video-compose" ||
    (itemId === "image" && nodeType === "sbv1-image") ||
    nodeType === "sbv1-video-engine";

  if (enabled) {
    onSpawn();
    return;
  }

  const labels: Record<string, string> = {
    video: "视频节点",
    text: "文本节点",
  };
  await alert({
    title: "即将推出",
    message: labels[itemId]
      ? `「${labels[itemId]}」将在后续版本接入。`
      : "该能力将在后续版本接入。",
    variant: "info",
  });
}

export async function handleSbv1GroupSidePick(
  groupId: string,
  itemId: string,
  nodeType: string | undefined,
  alert: (opts: {
    title: string;
    message: string;
    variant?: "info" | "warning" | "error";
  }) => Promise<void>,
  store: SpawnStore,
): Promise<void> {
  await handleSbv1SideAddNodePick(itemId, nodeType, alert, () => {
    if (
      itemId === "video-engine" ||
      itemId === "video-compose" ||
      nodeType === "sbv1-video-engine"
    ) {
      spawnSbv1VideoEngineFromGroup(groupId, store);
    }
  });
}
