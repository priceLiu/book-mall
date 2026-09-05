"use client";

import { nanoid } from "nanoid";
import type { LucideIcon } from "lucide-react";
import {
  Box,
  Film,
  Layers,
  ScanFace,
  SlidersHorizontal,
  Sparkles,
  User,
  Wand2,
} from "lucide-react";
import {
  buildPro2ImageEditNodeData,
  CANVAS_IMAGE_EDIT_MODEL_KEYS,
  isDirectCanvasImageEditMenuId,
  type CanvasImageEditModelKey,
} from "./canvas-image-edit-models";
import {
  buildPro2GeneralTextNodeData,
  buildPro2ImageNodeData,
  buildPro2ThreeViewNodeData,
} from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import {
  PRO2_CHARACTER_THREE_VIEW_HEIGHT,
  PRO2_CHARACTER_THREE_VIEW_WIDTH,
  PRO2_IMAGE_NODE_WIDTH,
} from "./story-pro2-node-chrome";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";

const GAP = 48;

export type LibtvImageEditMenuId =
  | CanvasImageEditModelKey
  | "character-face-three-view"
  | "character-design"
  | "scene-design"
  | "product-design"
  | "frame-grid-25"
  | "lighting-grade"
  | "character-three-view";

export type LibtvImageEditMenuItem = {
  id: LibtvImageEditMenuId;
  label: string;
  icon: LucideIcon;
  /** Gateway 直连图像编辑（千问 / 万相 2.7 Pro） */
  directImageEdit?: boolean;
};

/** 图片节点 ·「编辑」下拉 · Gateway 图像编辑（平台代付） */
export const LIBTV_IMAGE_DIRECT_EDIT_MENU: LibtvImageEditMenuItem[] = [
  {
    id: "qwen-image-edit",
    label: "千问 · 图像编辑",
    icon: Sparkles,
    directImageEdit: true,
  },
  {
    id: "wan2.7-image-pro",
    label: "万相 2.7 Pro · 编辑",
    icon: Wand2,
    directImageEdit: true,
  },
];

export const LIBTV_IMAGE_EDIT_WORKFLOW_MENU: LibtvImageEditMenuItem[] = [
  { id: "character-face-three-view", label: "角色脸部三视图", icon: ScanFace },
  { id: "character-design", label: "角色设定图", icon: User },
  { id: "scene-design", label: "场景设定图", icon: Layers },
  { id: "product-design", label: "产品设定图", icon: Box },
  { id: "frame-grid-25", label: "25宫格连贯分镜", icon: Film },
  { id: "lighting-grade", label: "电影级光影校正", icon: SlidersHorizontal },
  { id: "character-three-view", label: "角色三视图", icon: User },
];

export const LIBTV_IMAGE_EDIT_MENU: LibtvImageEditMenuItem[] = [
  ...LIBTV_IMAGE_DIRECT_EDIT_MENU,
  ...LIBTV_IMAGE_EDIT_WORKFLOW_MENU,
];

export { CANVAS_IMAGE_EDIT_MODEL_KEYS };

export type LibtvImageEditSpawnStore = {
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

type EditTargetSpec = {
  nodeType: CanvasNodeType;
  data: Record<string, unknown>;
  width: number;
};

function editTargetHandle(nodeType: CanvasNodeType): string {
  if (
    nodeType === "story-pro2-starter" ||
    nodeType === "story-pro2-script-hub"
  ) {
    return "in_text";
  }
  return "in_image";
}

type LibtvImageEditWorkflowMenuId = Exclude<
  LibtvImageEditMenuId,
  CanvasImageEditModelKey
>;

function targetSpec(menuId: LibtvImageEditWorkflowMenuId): EditTargetSpec {
  switch (menuId) {
    case "character-face-three-view":
      return {
        nodeType: "story-pro2-three-view",
        data: buildPro2ThreeViewNodeData({
          label: "角色脸部三视图",
          dockInput:
            "生成角色脸部三视图 turnaround：正面、3/4、侧面特写，白底，五官清晰一致。",
        }),
        width: PRO2_CHARACTER_THREE_VIEW_WIDTH,
      };
    case "character-design":
      return {
        nodeType: "story-pro2-three-view",
        data: buildPro2ThreeViewNodeData({
          label: "角色设定图",
          dockInput: "生成角色设定 turnaround sheet，白底全身，服饰细节清晰。",
        }),
        width: PRO2_CHARACTER_THREE_VIEW_WIDTH,
      };
    case "scene-design":
      return {
        nodeType: "story-pro2-image",
        data: buildPro2ImageNodeData({
          pro2MediaRole: "scene",
          label: "场景设计",
        }),
        width: PRO2_IMAGE_NODE_WIDTH,
      };
    case "product-design":
      return {
        nodeType: "story-pro2-image",
        data: buildPro2ImageNodeData({
          pro2MediaRole: "prop",
          label: "产品设定图",
        }),
        width: PRO2_IMAGE_NODE_WIDTH,
      };
    case "frame-grid-25":
      return {
        nodeType: "story-pro2-starter",
        data: buildPro2GeneralTextNodeData({
          label: "25宫格连贯分镜",
          pro2TextPurpose: "general",
          themeInput:
            "根据参考图生成 25 格连贯分镜描述（5×5），每格一行：镜号 + 画面 + 动作。",
        }),
        width: PRO2_IMAGE_NODE_WIDTH,
      };
    case "lighting-grade":
      return {
        nodeType: "story-pro2-starter",
        data: buildPro2GeneralTextNodeData({
          label: "电影级光影校正",
          pro2TextPurpose: "general",
          themeInput:
            "分析参考图光影，输出电影级光影校正指令：主光方向、色温、对比度、补光与氛围。",
        }),
        width: PRO2_IMAGE_NODE_WIDTH,
      };
    case "character-three-view":
      return {
        nodeType: "story-pro2-three-view",
        data: buildPro2ThreeViewNodeData({
          label: "角色三视图",
        }),
        width: PRO2_CHARACTER_THREE_VIEW_WIDTH,
      };
  }
}

function spawnDirectImageEditTarget(
  sourceNodeId: string,
  modelKey: CanvasImageEditModelKey,
  store: LibtvImageEditSpawnStore,
): string {
  const anchor = store.nodes.find((n) => n.id === sourceNodeId);
  if (!anchor) return "";

  const anchorW = anchor.width ?? PRO2_IMAGE_NODE_WIDTH;
  const position = {
    x: anchor.position.x + anchorW + GAP,
    y: anchor.position.y,
  };

  const newId = store.addNode(
    "story-pro2-image",
    position,
    buildPro2ImageEditNodeData({ modelKey }),
  );
  if (!newId) return "";

  store.setEdges((prev) => [
    ...prev,
    {
      id: `e-${nanoid(6)}`,
      source: sourceNodeId,
      target: newId,
      sourceHandle: "image",
      targetHandle: "in_image",
    },
  ]);

  selectPro2NodeAfterSpawn(store.setNodes, newId);
  return newId;
}

/** 图片节点 ·「编辑」菜单 · 右侧生成 Pro2 节点并连线，参考图进入 Dock 上游缩略图 */
export function spawnLibtvImageEditTarget(
  sourceNodeId: string,
  menuId: LibtvImageEditMenuId,
  store: LibtvImageEditSpawnStore,
): string {
  if (isDirectCanvasImageEditMenuId(menuId)) {
    return spawnDirectImageEditTarget(sourceNodeId, menuId, store);
  }

  const anchor = store.nodes.find((n) => n.id === sourceNodeId);
  if (!anchor) return "";

  const spec = targetSpec(menuId);
  const anchorW = anchor.width ?? PRO2_IMAGE_NODE_WIDTH;
  const position = {
    x: anchor.position.x + anchorW + GAP,
    y: anchor.position.y,
  };

  const newId = store.addNode(spec.nodeType, position, spec.data);
  if (!newId) return "";

  store.setEdges((prev) => [
    ...prev,
    {
      id: `e-${nanoid(6)}`,
      source: sourceNodeId,
      target: newId,
      sourceHandle: "image",
      targetHandle: editTargetHandle(spec.nodeType),
    },
  ]);

  if (spec.nodeType === "story-pro2-three-view") {
    store.setNodes((prev) =>
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
  }

  selectPro2NodeAfterSpawn(store.setNodes, newId);
  return newId;
}
