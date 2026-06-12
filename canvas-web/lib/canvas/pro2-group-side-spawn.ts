"use client";

import { handlePro2SideAddNodePick } from "./pro2-add-node-pick";
import {
  buildPro2ImageNodeData,
  buildPro2StarterNodeData,
  spawnPro2ScriptHubFromSource,
} from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { PRO2_IMAGE_NODE_WIDTH } from "./story-pro2-node-chrome";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";

function mediaChildren(groupId: string, nodes: CanvasFlowNode[]): CanvasFlowNode[] {
  return nodes.filter(
    (n) =>
      n.parentId === groupId &&
      (n.type === "story-pro2-image" || n.type === "story-pro2-three-view"),
  );
}

type SpawnStore = {
  nodes: CanvasFlowNode[];
  addNode: (
    type: CanvasNodeType,
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setNodes: (
    fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[],
  ) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
};

/** 媒体组左右 + 菜单 · 在组框外侧生成邻居节点并连线 */
export function spawnPro2NeighborFromGroup(
  groupId: string,
  side: "left" | "right",
  nodeType: string | undefined,
  store: SpawnStore,
): void {
  if (!nodeType) return;
  const { nodes, addNode, setNodes, setEdges } = store;
  const group = nodes.find((n) => n.id === groupId);
  if (!group) return;

  const children = mediaChildren(groupId, nodes);
  const refChild = side === "left" ? children[0] : children[children.length - 1];
  const refId = refChild?.id ?? groupId;

  const gap = 48;
  const gw = group.width ?? 360;
  const w = refChild?.width ?? PRO2_IMAGE_NODE_WIDTH;
  const x =
    side === "left"
      ? group.position.x - w - gap
      : group.position.x + gw + gap;
  const y = group.position.y + 40;

  if (nodeType === "story-pro2-starter") {
    const newId = addNode("story-pro2-starter", { x, y }, buildPro2StarterNodeData());
    if (!newId) return;
    const edge =
      side === "left"
        ? {
            id: `e-${newId}-${refId}`,
            source: newId,
            target: refId,
            sourceHandle: "text",
            targetHandle: refChild ? "in_image" : "in_text",
          }
        : {
            id: `e-${refId}-${newId}`,
            source: refId,
            target: newId,
            sourceHandle: refChild ? "image" : "out_media",
            targetHandle: "in_text",
          };
    setEdges((prev) => [...prev, edge]);
    selectPro2NodeAfterSpawn(setNodes, newId);
    return;
  }

  if (nodeType === "story-pro2-image") {
    const newId = addNode("story-pro2-image", { x, y }, buildPro2ImageNodeData());
    if (!newId) return;
    const edge =
      side === "left"
        ? {
            id: `e-${newId}-${refId}`,
            source: newId,
            target: refId,
            sourceHandle: "image",
            targetHandle: "in_image",
          }
        : {
            id: `e-${refId}-${newId}`,
            source: refId,
            target: newId,
            sourceHandle: refChild ? "image" : "out_media",
            targetHandle: "in_image",
          };
    setEdges((prev) => [...prev, edge]);
    selectPro2NodeAfterSpawn(setNodes, newId);
    return;
  }

  if (nodeType === "story-pro2-script-hub") {
    spawnPro2ScriptHubFromSource({
      sourceId: refId,
      sourceHandle: refChild ? "image" : "out_media",
      position: { x, y },
      addNode: (type, position, nodeData) =>
        addNode(type, position, nodeData),
      setEdges,
      setNodes,
    });
  }
}

export async function handlePro2GroupSidePick(
  groupId: string,
  side: "left" | "right",
  itemId: string,
  nodeType: string | undefined,
  alert: (opts: {
    title: string;
    message: string;
    variant?: "info" | "warning" | "error";
  }) => Promise<void>,
  store: SpawnStore,
): Promise<void> {
  await handlePro2SideAddNodePick(
    itemId,
    nodeType,
    { alert },
    () => {
      if (itemId === "text" || nodeType === "story-pro2-starter") {
        spawnPro2NeighborFromGroup(groupId, side, "story-pro2-starter", store);
        return;
      }
      if (itemId === "image" || nodeType === "story-pro2-image") {
        spawnPro2NeighborFromGroup(groupId, side, "story-pro2-image", store);
        return;
      }
      if (itemId === "script" || nodeType === "story-pro2-script-hub") {
        spawnPro2NeighborFromGroup(groupId, side, "story-pro2-script-hub", store);
      }
    },
  );
}
