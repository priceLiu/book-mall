"use client";

import { nanoid } from "nanoid";
import {
  buildPro2AudioNodeData,
  buildPro2GeneralTextNodeData,
  buildPro2ImageNodeData,
  buildPro2StarterNodeData,
  buildPro2ThreeViewNodeData,
  spawnPro2ScriptHubFromSource,
} from "./pro2-spawn-nodes";
import { buildPro2EmptyStyleAssetNodeData } from "./pro2-spawn-style-asset";
import {
  buildPro2StyleAssetToImageEdge,
  buildPro2StyleAssetToVideoEdge,
} from "./pro2-style-asset-connect";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { selectSbv1NodeAfterSpawn, buildSbv1VideoEngineNodeData } from "./sbv1-spawn-nodes";
import { SBV1_VIDEO_ENGINE_WIDTH } from "./sbv1-node-chrome";
import {
  PRO2_CHARACTER_THREE_VIEW_HEIGHT,
  PRO2_CHARACTER_THREE_VIEW_WIDTH,
  PRO2_IMAGE_NODE_WIDTH,
  PRO2_TEXT_NODE_MIN_WIDTH,
} from "./story-pro2-node-chrome";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";
import { flowPositionAtScreenPoint } from "./viewport-placement";
import { useCanvasStore } from "./store";

const GAP = 48;

export type LibtvSideSpawnOptions = {
  /** 松手位置（屏幕坐标）· 优先于邻居偏移 */
  atScreen?: { x: number; y: number };
};

export type LibtvSideSpawnStore = {
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
  setNodes: (
    fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[],
  ) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
};

function spawnWidth(nodeType: string, anchor: CanvasFlowNode): number {
  if (nodeType === "sbv1-video-engine") return SBV1_VIDEO_ENGINE_WIDTH;
  if (nodeType === "story-pro2-three-view") return PRO2_CHARACTER_THREE_VIEW_WIDTH;
  if (nodeType === "story-pro2-starter") return PRO2_TEXT_NODE_MIN_WIDTH;
  if (nodeType === "story-pro2-script-hub") {
    return anchor.width ?? PRO2_TEXT_NODE_MIN_WIDTH;
  }
  return anchor.width ?? PRO2_IMAGE_NODE_WIDTH;
}

function anchorSourceHandle(anchor: CanvasFlowNode): string {
  if (
    anchor.type === "story-pro2-starter" ||
    anchor.type === "story-pro2-script-hub"
  ) {
    return "text";
  }
  return "image";
}

function canRefVideoFromAnchor(anchor: CanvasFlowNode): boolean {
  return (
    anchor.type === "story-pro2-image" ||
    anchor.type === "story-pro2-three-view" ||
    anchor.type === "story-pro2-3d-desk" ||
    anchor.type === "sbv1-image"
  );
}

function pushEdge(
  setEdges: LibtvSideSpawnStore["setEdges"],
  edge: CanvasFlowEdge,
) {
  setEdges((prev) => [...prev, edge]);
}

/** 侧 + / 邻居菜单 · 生成已有 LibTV 节点（三视图 · 视频引擎等）并可选连线 */
export function spawnLibtvNeighborFromAnchor(
  anchorId: string,
  side: "left" | "right",
  nodeType: string,
  store: LibtvSideSpawnStore,
  options?: LibtvSideSpawnOptions,
): string {
  const { nodes, addNode, setNodes, setEdges } = store;
  const anchor = nodes.find((n) => n.id === anchorId);
  if (!anchor || !nodeType) return "";

  const newW = spawnWidth(nodeType, anchor);
  const anchorW = anchor.width ?? PRO2_IMAGE_NODE_WIDTH;
  const neighborPos = {
    x:
      side === "left"
        ? anchor.position.x - newW - GAP
        : anchor.position.x + anchorW + GAP,
    y: anchor.position.y,
  };
  const position = options?.atScreen
    ? flowPositionAtScreenPoint(nodeType as CanvasNodeType, options.atScreen)
    : neighborPos;

  if (nodeType === "story-pro2-starter") {
    const newId = addNode(
      "story-pro2-starter",
      { x: position.x, y: position.y },
      side === "left" ? buildPro2GeneralTextNodeData() : buildPro2StarterNodeData(),
    );
    if (!newId) return "";
    const targetHandle =
      anchor.type === "story-pro2-starter" ||
      anchor.type === "story-pro2-script-hub"
        ? "in_text"
        : "in_image";
    pushEdge(setEdges, {
      id: `e-${nanoid(6)}`,
      source: side === "left" ? newId : anchorId,
      target: side === "left" ? anchorId : newId,
      sourceHandle: side === "left" ? "text" : anchorSourceHandle(anchor),
      targetHandle: side === "left" ? targetHandle : "in_text",
    });
    selectPro2NodeAfterSpawn(setNodes, newId);
    return newId;
  }

  if (nodeType === "story-pro2-image") {
    const newId = addNode("story-pro2-image", { x: position.x, y: position.y }, buildPro2ImageNodeData());
    if (!newId) return "";
    const anchorIsText =
      anchor.type === "story-pro2-starter" ||
      anchor.type === "story-pro2-script-hub";
    pushEdge(setEdges, {
      id: `e-${nanoid(6)}`,
      source: side === "left" ? newId : anchorId,
      target: side === "left" ? anchorId : newId,
      sourceHandle:
        side === "left"
          ? "image"
          : anchorIsText
            ? "text"
            : "image",
      targetHandle:
        side === "left"
          ? anchorIsText
            ? "in_text"
            : "in_image"
          : "in_image",
    });
    selectPro2NodeAfterSpawn(setNodes, newId);
    return newId;
  }

  if (nodeType === "story-pro2-three-view") {
    const newId = addNode(
      "story-pro2-three-view",
      { x: position.x, y: position.y },
      buildPro2ThreeViewNodeData(),
    );
    if (!newId) return "";
    const anchorIsText =
      anchor.type === "story-pro2-starter" ||
      anchor.type === "story-pro2-script-hub";
    if (
      anchor.type === "story-pro2-image" ||
      anchor.type === "story-pro2-three-view"
    ) {
      pushEdge(setEdges, {
        id: `e-${nanoid(6)}`,
        source: side === "left" ? newId : anchorId,
        target: side === "left" ? anchorId : newId,
        sourceHandle: "image",
        targetHandle: "in_image",
      });
    } else if (anchorIsText) {
      pushEdge(setEdges, {
        id: `e-${nanoid(6)}`,
        source: side === "left" ? newId : anchorId,
        target: side === "left" ? anchorId : newId,
        sourceHandle: side === "left" ? "image" : "text",
        targetHandle: side === "left" ? "in_text" : "in_image",
      });
    }
    setNodes((prev) =>
      prev.map((n) =>
        n.id === newId
          ? {
              ...n,
              width: PRO2_CHARACTER_THREE_VIEW_WIDTH,
              height: PRO2_CHARACTER_THREE_VIEW_HEIGHT,
              style: {
                width: PRO2_CHARACTER_THREE_VIEW_WIDTH,
                height: PRO2_CHARACTER_THREE_VIEW_HEIGHT,
              },
            }
          : n,
      ),
    );
    selectPro2NodeAfterSpawn(setNodes, newId);
    return newId;
  }

  if (nodeType === "story-pro2-3d-desk") {
    const newId = addNode("story-pro2-3d-desk", { x: position.x, y: position.y }, {
      label: "",
      sceneInstanceId: "",
    });
    if (!newId) return "";
    useCanvasStore.getState().updateNodeData(newId, { sceneInstanceId: newId });
    const anchorIsImage =
      anchor.type === "story-pro2-image" ||
      anchor.type === "story-pro2-three-view" ||
      anchor.type === "story-pro2-3d-desk" ||
      anchor.type === "sbv1-image";
    const anchorIsText =
      anchor.type === "story-pro2-starter" ||
      anchor.type === "story-pro2-script-hub";
    if (anchorIsImage) {
      pushEdge(setEdges, {
        id: `e-${nanoid(6)}`,
        source: side === "right" ? anchorId : newId,
        target: side === "right" ? newId : anchorId,
        sourceHandle: "image",
        targetHandle: side === "right" ? "panorama" : "in_image",
      });
    } else if (side === "right" && anchor.type === "sbv1-video-engine") {
      pushEdge(setEdges, {
        id: `e-${nanoid(6)}`,
        source: newId,
        target: anchorId,
        sourceHandle: "image",
        targetHandle: "in_ref",
      });
    } else if (side === "right" && anchorIsText) {
      // 故事脚本生成 / 文本 → 导演台（脚本引用进 3D）
      pushEdge(setEdges, {
        id: `e-${nanoid(6)}`,
        source: anchorId,
        target: newId,
        sourceHandle: "text",
        targetHandle: "panorama",
      });
    } else if (side === "left" && anchorIsText) {
      pushEdge(setEdges, {
        id: `e-${nanoid(6)}`,
        source: newId,
        target: anchorId,
        sourceHandle: "image",
        targetHandle: "in_text",
      });
    }
    selectPro2NodeAfterSpawn(setNodes, newId);
    // 等节点写入 store 后再开全屏，避免 host 因找不到节点直接 return null
    queueMicrotask(() => {
      useCanvasStore.getState().openDirector3dDeskEditor(newId);
    });
    return newId;
  }

  if (nodeType === "sbv1-video-engine") {
    const newId = addNode("sbv1-video-engine", { x: position.x, y: position.y }, buildSbv1VideoEngineNodeData());
    if (!newId) return "";
    if (canRefVideoFromAnchor(anchor) && side === "right") {
      pushEdge(setEdges, {
        id: `e-${nanoid(6)}`,
        source: anchorId,
        target: newId,
        sourceHandle: "image",
        targetHandle: "in_ref",
      });
    } else if (
      side === "right" &&
      (anchor.type === "story-pro2-starter" ||
        anchor.type === "story-pro2-script-hub")
    ) {
      // 文生视频：文本右侧 + → 视频（text → in_text）
      pushEdge(setEdges, {
        id: `e-${nanoid(6)}`,
        source: anchorId,
        target: newId,
        sourceHandle: "text",
        targetHandle: "in_text",
      });
    } else if (
      side === "left" &&
      (anchor.type === "story-pro2-starter" ||
        anchor.type === "story-pro2-script-hub")
    ) {
      pushEdge(setEdges, {
        id: `e-${nanoid(6)}`,
        source: newId,
        target: anchorId,
        sourceHandle: "out_video",
        targetHandle: "in_text",
      });
    } else if (anchor.type === "sbv1-video-engine" && side === "right") {
      pushEdge(setEdges, {
        id: `e-${nanoid(6)}`,
        source: anchorId,
        target: newId,
        sourceHandle: "out_video",
        targetHandle: "in_motion_video",
      });
    }
    selectSbv1NodeAfterSpawn(setNodes, newId);
    return newId;
  }

  if (nodeType === "story-pro2-audio") {
    const newId = addNode(
      "story-pro2-audio",
      { x: position.x, y: position.y },
      buildPro2AudioNodeData(),
    );
    if (!newId) return "";
    const anchorIsText =
      anchor.type === "story-pro2-starter" ||
      anchor.type === "story-pro2-script-hub";
    if (anchorIsText) {
      pushEdge(setEdges, {
        id: `e-${nanoid(6)}`,
        source: side === "left" ? newId : anchorId,
        target: side === "left" ? anchorId : newId,
        sourceHandle: side === "left" ? "audio" : "text",
        targetHandle: side === "left" ? "in_text" : "in_audio",
      });
    }
    selectPro2NodeAfterSpawn(setNodes, newId);
    return newId;
  }

  if (nodeType === "story-pro2-script-hub") {
    spawnPro2ScriptHubFromSource({
      sourceId: anchorId,
      sourceHandle: anchorSourceHandle(anchor),
      position: { x: position.x, y: position.y },
      addNode: (type, position, nodeData) =>
        addNode(type, position, nodeData),
      setEdges,
      setNodes,
    });
    return "";
  }

  if (nodeType === "story-pro2-style-asset" && side === "left") {
    const newId = addNode(
      "story-pro2-style-asset",
      { x: position.x, y: position.y },
      buildPro2EmptyStyleAssetNodeData() as unknown as Record<string, unknown>,
    );
    if (!newId) return "";
    if (anchor.type === "sbv1-video-engine") {
      pushEdge(setEdges, buildPro2StyleAssetToVideoEdge(newId, anchorId));
    } else if (
      anchor.type === "story-pro2-image" ||
      anchor.type === "story-pro2-three-view" ||
      anchor.type === "sbv1-image"
    ) {
      pushEdge(setEdges, buildPro2StyleAssetToImageEdge(newId, anchorId));
    }
    selectPro2NodeAfterSpawn(setNodes, newId);
    return newId;
  }

  return "";
}

export function isLibtvSideSpawnNodeType(nodeType?: string): boolean {
  return (
    nodeType === "story-pro2-starter" ||
    nodeType === "story-pro2-image" ||
    nodeType === "story-pro2-three-view" ||
    nodeType === "story-pro2-3d-desk" ||
    nodeType === "story-pro2-script-hub" ||
    nodeType === "story-pro2-style-asset" ||
    nodeType === "story-pro2-audio" ||
    nodeType === "sbv1-video-engine"
  );
}

export function resolveLibtvSideSpawnNodeType(
  itemId: string,
  nodeType?: string,
): string | undefined {
  if (nodeType && isLibtvSideSpawnNodeType(nodeType)) return nodeType;
  if (itemId === "text") return "story-pro2-starter";
  if (itemId === "image") return "story-pro2-image";
  if (itemId === "three-view") return "story-pro2-three-view";
  if (itemId === "3d-desk") return "story-pro2-3d-desk";
  if (itemId === "script") return "story-pro2-script-hub";
  if (itemId === "style-asset") return "story-pro2-style-asset";
  if (itemId === "audio") return "story-pro2-audio";
  if (
    itemId === "video" ||
    itemId === "video-compose" ||
    itemId === "video-engine"
  ) {
    return "sbv1-video-engine";
  }
  return undefined;
}
