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
import {
  SBV1_DEFAULT_IMAGE_NODE_DATA,
  SBV1_DEFAULT_VIDEO_ENGINE_DATA,
} from "./sbv1-workspace-types";
import {
  buildPro2GeneralTextNodeData,
} from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { cloneCanvasNodeData } from "./clone-node-data";
import { PRO2_TEXT_NODE_MIN_WIDTH } from "./story-pro2-node-chrome";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";
import { flowPositionAtScreenPoint } from "./viewport-placement";

const GAP = 48;
const JIANYING_EXPORT_PRO2_WIDTH = 400;
const JIANYING_AUTO_RENDER_PRO2_WIDTH = 720;

export function buildSbv1ImageNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...cloneCanvasNodeData(SBV1_DEFAULT_IMAGE_NODE_DATA),
    ...cloneCanvasNodeData(overrides),
  };
}

export function buildSbv1VideoEngineNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...cloneCanvasNodeData(SBV1_DEFAULT_VIDEO_ENGINE_DATA),
    ...cloneCanvasNodeData(overrides),
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
  options?: {
    spawnMode?: "txt2img" | "img2img";
    connectFromAnchor?: boolean;
    /** 左侧 + · 动作视频：上游视频 out_video → 本节点 in_motion_video */
    connectAsMotionVideo?: boolean;
    /** 松手位置（屏幕坐标）· 优先于邻居偏移 */
    atScreen?: { x: number; y: number };
  },
): string {
  const { nodes, addNode, setNodes, setEdges } = store;
  const self = nodes.find((n) => n.id === anchorId);
  if (!self) return "";

  if (
    nodeType === "sbv1-video-engine" &&
    side === "right" &&
    self.type === "sbv1-image" &&
    self.parentId &&
    !options?.atScreen
  ) {
    const group = nodes.find((n) => n.id === self.parentId);
    if (group && isSbv1MediaGroup(group, nodes)) {
      const existingEngine = nodes.some(
        (n) => n.parentId === self.parentId && n.type === "sbv1-video-engine",
      );
      // 组内还没有合成节点：纳入组内并接入全部图片；
      // 已有合成节点：继续从当前图片生成新的独立视频节点（见下方通用分支）。
      if (!existingEngine) {
        return spawnSbv1VideoEngineFromGroup(self.parentId, store);
      }
    }
  }

  const newNodeW =
    nodeType === "jianying-export-pro2"
      ? JIANYING_EXPORT_PRO2_WIDTH
      : nodeType === "jianying-auto-render-pro2"
        ? JIANYING_AUTO_RENDER_PRO2_WIDTH
        : nodeType === "sbv1-video-engine"
          ? SBV1_VIDEO_ENGINE_WIDTH
          : nodeType === "story-pro2-starter"
            ? PRO2_TEXT_NODE_MIN_WIDTH
            : SBV1_IMAGE_NODE_WIDTH;
  const neighborPos = sbv1NeighborFlowPosition(
    self,
    nodes,
    side,
    newNodeW,
    nodeType,
  );
  const spawnPos = options?.atScreen
    ? flowPositionAtScreenPoint(nodeType as CanvasNodeType, options.atScreen)
    : neighborPos;
  const x = spawnPos.x;
  const y = spawnPos.y;

  if (nodeType === "story-pro2-starter") {
    const newId = addNode(
      "story-pro2-starter",
      { x, y },
      buildPro2GeneralTextNodeData(),
    );
    if (!newId) return "";
    if (self.type === "sbv1-video-engine" && side === "left") {
      setEdges((prev) => [
        ...prev,
        {
          id: `e-${newId}-${anchorId}-text`,
          source: newId,
          target: anchorId,
          sourceHandle: "text",
          targetHandle: "in_text",
        },
      ]);
    }
    selectPro2NodeAfterSpawn(setNodes, newId);
    return newId;
  }

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

  if (nodeType === "jianying-export-pro2") {
    const newId = addNode(
      "jianying-export-pro2",
      { x, y },
      { label: "导出剪辑" },
    );
    if (!newId) return "";
    if (self.type === "sbv1-video-engine" && side === "right") {
      setEdges((prev) => [
        ...prev,
        {
          id: `e-${anchorId}-${newId}`,
          source: anchorId,
          target: newId,
          sourceHandle: "out_video",
          targetHandle: "in_video",
        },
      ]);
    }
    selectSbv1NodeAfterSpawn(setNodes, newId);
    return newId;
  }

  if (nodeType === "jianying-auto-render-pro2") {
    const newId = addNode(
      "jianying-auto-render-pro2",
      { x, y },
      { label: "自动成片" },
    );
    if (!newId) return "";
    if (self.type === "sbv1-video-engine" && side === "right") {
      setEdges((prev) => [
        ...prev,
        {
          id: `e-${anchorId}-${newId}`,
          source: anchorId,
          target: newId,
          sourceHandle: "out_video",
          targetHandle: "in_video",
        },
      ]);
    }
    selectSbv1NodeAfterSpawn(setNodes, newId);
    return newId;
  }

  if (nodeType === "sbv1-video-engine") {
    const newId = addNode("sbv1-video-engine", { x, y }, buildSbv1VideoEngineNodeData());
    if (!newId) return "";
    if (self.type === "sbv1-video-engine" && side === "left" && options?.connectAsMotionVideo) {
      setEdges((prev) => [
        ...prev,
        {
          id: `e-${newId}-${anchorId}-motion`,
          source: newId,
          target: anchorId,
          sourceHandle: "out_video",
          targetHandle: "in_motion_video",
        },
      ]);
    } else if (self.type === "jianying-export-pro2" && side === "left") {
      setEdges((prev) => [
        ...prev,
        {
          id: `e-${newId}-${anchorId}-video`,
          source: newId,
          target: anchorId,
          sourceHandle: "out_video",
          targetHandle: "in_video",
        },
      ]);
    } else {
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
    }
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
    buildSbv1VideoEngineNodeData(),
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
    (itemId === "video" ||
      itemId === "video-compose" ||
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
    itemId === "video" ||
    itemId === "video-engine" ||
    itemId === "video-compose" ||
    itemId === "export" ||
    itemId === "style-asset" ||
    (itemId === "image" && nodeType === "sbv1-image") ||
    nodeType === "sbv1-video-engine" ||
    nodeType === "jianying-export-pro2" ||
    nodeType === "story-pro2-starter" ||
    nodeType === "story-pro2-style-asset";

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

/** sbv1 媒体组左右 + · 在组框外侧生成邻居节点并连线 */
export function spawnSbv1NeighborFromGroup(
  groupId: string,
  side: "left" | "right",
  nodeType: "sbv1-image",
  store: SpawnStore,
  options?: { spawnMode?: "txt2img" | "img2img" },
): string {
  const { nodes, addNode, setNodes, setEdges } = store;
  const group = nodes.find((n) => n.id === groupId);
  if (!group) return "";

  const children = nodes.filter(
    (n) => n.parentId === groupId && n.type === "sbv1-image",
  );
  const refChild = side === "left" ? children[0] : children[children.length - 1];
  const refId = refChild?.id ?? groupId;

  const gap = 48;
  const gw = group.width ?? 360;
  const w = refChild?.width ?? SBV1_IMAGE_NODE_WIDTH;
  const x =
    side === "left" ? group.position.x - w - gap : group.position.x + gw + gap;
  const y = group.position.y + 40;

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

  const edge =
    side === "left"
      ? {
          id: `e-${newId}-${refId}`,
          source: newId,
          target: refId,
          sourceHandle: "image",
          targetHandle: refChild ? "in_image" : "in_ref",
        }
      : {
          id: `e-${refId}-${newId}`,
          source: refId,
          target: newId,
          sourceHandle: refChild ? "image" : "out_media",
          targetHandle: "in_image",
        };
  setEdges((prev) => [...prev, edge]);
  selectSbv1NodeAfterSpawn(setNodes, newId);
  return newId;
}

export async function handleSbv1GroupSidePick(
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
  await handleSbv1SideAddNodePick(itemId, nodeType, alert, () => {
    if (
      side === "right" &&
      (itemId === "video" ||
        itemId === "video-engine" ||
        itemId === "video-compose" ||
        nodeType === "sbv1-video-engine")
    ) {
      spawnSbv1VideoEngineFromGroup(groupId, store);
      return;
    }
    if (
      side === "left" &&
      (itemId === "txt2img" ||
        itemId === "img2img" ||
        itemId === "image" ||
        nodeType === "sbv1-image")
    ) {
      spawnSbv1NeighborFromGroup(
        groupId,
        "left",
        "sbv1-image",
        store,
        {
          spawnMode:
            itemId === "txt2img"
              ? "txt2img"
              : itemId === "img2img"
                ? "img2img"
                : undefined,
        },
      );
    }
  });
}
