"use client";

import { nanoid } from "nanoid";
import type { LucideIcon } from "lucide-react";
import { Expand, Sparkles } from "lucide-react";
import { buildPro2ImageNodeData } from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { PRO2_IMAGE_NODE_WIDTH } from "./story-pro2-node-chrome";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const GAP = 48;

export type LibtvImageMagicMenuId = "hd-upscale" | "source-expand";

export type LibtvImageMagicMenuItem = {
  id: LibtvImageMagicMenuId;
  label: string;
  icon: LucideIcon;
};

export const LIBTV_IMAGE_MAGIC_MENU: LibtvImageMagicMenuItem[] = [
  { id: "hd-upscale", label: "高清", icon: Sparkles },
  { id: "source-expand", label: "原图扩图", icon: Expand },
];

export type LibtvImageMagicSpawnStore = {
  nodes: CanvasFlowNode[];
  addNode: (
    type: "story-pro2-image",
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
};

function magicTargetData(menuId: LibtvImageMagicMenuId): Record<string, unknown> {
  switch (menuId) {
    case "hd-upscale":
      return buildPro2ImageNodeData({
        label: "高清",
        dockInput: "将参考图超分辨率增强为高清画质，保持内容与构图一致。",
      });
    case "source-expand":
      return buildPro2ImageNodeData({
        label: "原图扩图",
        dockInput: "在保持原图主体不变的前提下向外扩图，补全画幅边缘。",
      });
  }
}

/** 图片节点 ·「魔术」菜单 · 右侧生成图片节点并连线，参考图进入 Dock 上游缩略图 */
export function spawnLibtvImageMagicTarget(
  sourceNodeId: string,
  menuId: LibtvImageMagicMenuId,
  store: LibtvImageMagicSpawnStore,
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
    magicTargetData(menuId),
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
