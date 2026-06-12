"use client";

import {
  SBV1_IMAGE_NODE_WIDTH,
  SBV1_VIDEO_ENGINE_WIDTH,
} from "./sbv1-node-chrome";
import { sbv1ImageChildren } from "./sbv1-media-group-meta";
import { applySbv1MediaGroupRelayout } from "./sbv1-media-group-layout";
import { SBV1_DEFAULT_VIDEO_ENGINE_DATA } from "./sbv1-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";

const GAP = 48;

export function buildSbv1ImageNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    label: "图片",
    ...overrides,
  };
}

export function selectSbv1NodeAfterSpawn(
  setNodes: (
    fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[],
  ) => void,
  nodeId: string,
): void {
  setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === nodeId })));
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

function nodeSize(node: CanvasFlowNode, fallbackW: number) {
  return {
    w: node.width ?? fallbackW,
    h: node.height ?? 360,
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

  const fallbackW =
    self.type === "sbv1-video-engine"
      ? SBV1_VIDEO_ENGINE_WIDTH
      : SBV1_IMAGE_NODE_WIDTH;
  const { w } = nodeSize(self, fallbackW);

  const x =
    side === "left" ? self.position.x - w - GAP : self.position.x + w + GAP;
  const y = self.position.y;

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
    return laid.map((n) => ({ ...n, selected: n.id === engineId }));
  });
  return engineId;
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
    if (itemId === "video-engine" || nodeType === "sbv1-video-engine") {
      spawnSbv1VideoEngineFromGroup(groupId, store);
    }
  });
}
