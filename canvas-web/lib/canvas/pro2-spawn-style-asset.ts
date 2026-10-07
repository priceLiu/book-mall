"use client";

import type { Connection } from "@xyflow/react";
import type { StyleLibraryPreset } from "./style-library/catalog";
import { styleLibraryPickerDefaults } from "./style-library/category-pickers";
import type { StoryPro2StyleAssetNodeData } from "./story-pro2-workspace-types";
import {
  absoluteNodePosition,
} from "./normalize-graph-nodes";
import {
  buildPro2StyleAssetToHubEdge,
  buildPro2StyleAssetToImageEdge,
  buildPro2StyleAssetToVideoEdge,
  findPro2StyleAssetSnapScriptHub,
  findStyleAssetLinkedToImage,
} from "./pro2-style-asset-connect";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { fitPro2StyleAssetNodeToPreviewImage } from "./pro2-style-asset-node-size";
import {
  PRO2_SCRIPT_NODE_WIDTH,
  PRO2_STYLE_ASSET_NODE_WIDTH,
} from "./story-pro2-node-chrome";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { flowPositionAtViewportCenter } from "./viewport-placement";

const SNAP_GAP = 48;

/** 图片 Dock · @ 引用 + 风格库 stylePrompt（存储态 @<up-style-{nodeId}>） */
export function buildPro2StyleRefDockInput(
  styleNodeId: string,
  stylePrompt?: string,
): string {
  const mention = `@<up-style-${styleNodeId}>`;
  const body = stylePrompt?.trim();
  if (body) {
    return `参考 ${mention} ${body} 风格生成图`;
  }
  return `参考 ${mention} 风格生成图`;
}

export function readPro2StyleAssetPrompt(
  styleNode: CanvasFlowNode | undefined,
): string {
  if (!styleNode || styleNode.type !== "story-pro2-style-asset") return "";
  const d = styleNode.data as StoryPro2StyleAssetNodeData;
  return d.stylePrompt?.trim() || d.styleAnchorZh?.trim() || "";
}

export function applyPro2StyleDockPromptToImageIfEmpty(
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  getNodes: () => CanvasFlowNode[],
  imageNodeId: string,
  styleNodeId: string,
): void {
  const image = getNodes().find((n) => n.id === imageNodeId);
  if (!image) return;
  const dockInput = (image.data as { dockInput?: string }).dockInput?.trim();
  if (dockInput) return;
  const styleNode = getNodes().find((n) => n.id === styleNodeId);
  updateNodeData(imageNodeId, {
    dockInput: buildPro2StyleRefDockInput(
      styleNodeId,
      readPro2StyleAssetPrompt(styleNode),
    ),
  });
}

function ensurePro2StyleAssetToMediaEdge(
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void,
  styleNodeId: string,
  mediaNodeId: string,
  mediaType: string,
): void {
  const styleEdge =
    mediaType === "sbv1-video-engine"
      ? buildPro2StyleAssetToVideoEdge(styleNodeId, mediaNodeId)
      : buildPro2StyleAssetToImageEdge(styleNodeId, mediaNodeId);
  setEdges((prev) => {
    if (
      prev.some(
        (e) => e.source === styleNodeId && e.target === mediaNodeId,
      )
    ) {
      return prev;
    }
    return [...prev, styleEdge];
  });
}

/** 侧栏 + 菜单 · 空白风格素材节点（待选风格库） */
export function buildPro2EmptyStyleAssetNodeData(): StoryPro2StyleAssetNodeData {
  return {
    presetId: "",
    label: "素材-风格",
    styleName: "",
    stylePrompt: "",
    imageUrl: "",
  };
}

export function buildPro2StyleAssetNodeData(
  preset: StyleLibraryPreset,
): StoryPro2StyleAssetNodeData {
  const pickers = styleLibraryPickerDefaults(preset.category);
  return {
    presetId: preset.id,
    styleName: preset.name,
    stylePrompt: preset.prompt,
    imageUrl: preset.imageUrl,
    label: `素材-风格-${preset.name}`,
    styleAnchorZh: preset.prompt,
    mainStyle: pickers.mainStyle,
    colorTone: pickers.colorTone,
    renderQuality: pickers.renderQuality,
  };
}

function resolveStyleAssetSpawnPosition(
  nodes: CanvasFlowNode[],
  fallback: { x: number; y: number },
): { x: number; y: number } {
  const hub = findPro2StyleAssetSnapScriptHub(nodes, fallback);
  if (!hub) return fallback;
  const hubW = hub.width ?? PRO2_SCRIPT_NODE_WIDTH;
  return {
    x: hub.position.x + hubW + SNAP_GAP,
    y: hub.position.y,
  };
}

export function spawnPro2StyleAssetFromPreset(args: {
  preset: StyleLibraryPreset;
  position?: { x: number; y: number };
  addNode: (
    type: "story-pro2-style-asset",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setNodes: (
    fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[],
  ) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  getNodes: () => CanvasFlowNode[];
}): string {
  const fallback =
    args.position ?? flowPositionAtViewportCenter("story-pro2-style-asset");
  const position = resolveStyleAssetSpawnPosition(args.getNodes(), fallback);

  const nodeId = args.addNode(
    "story-pro2-style-asset",
    position,
    buildPro2StyleAssetNodeData(args.preset) as unknown as Record<
      string,
      unknown
    >,
  );
  if (!nodeId) return "";

  selectPro2NodeAfterSpawn(args.setNodes, nodeId);

  const hub = findPro2StyleAssetSnapScriptHub(args.getNodes(), position);
  if (hub) {
    args.setEdges((prev) => {
      if (
        prev.some(
          (e) => e.source === nodeId && e.target === hub.id,
        )
      ) {
        return prev;
      }
      return [...prev, buildPro2StyleAssetToHubEdge(nodeId, hub.id)];
    });
  }

  const previewUrl = args.preset.imageUrl?.trim();
  if (previewUrl) {
    fitPro2StyleAssetNodeToPreviewImage(nodeId, previewUrl);
  }

  return nodeId;
}

const DOCK_STYLE_MEDIA_TYPES = new Set([
  "story-pro2-image",
  "story-pro2-three-view",
  "sbv1-image",
  "sbv1-video-engine",
]);

/** Dock / + 菜单风格库 · 在目标媒体节点左侧生成/更新风格素材并连线 */
export function spawnPro2StyleAssetLeftOfImageFromPreset(args: {
  preset: StyleLibraryPreset;
  imageNodeId: string;
  addNode: (
    type: "story-pro2-style-asset",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setNodes: (
    fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[],
  ) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  getNodes: () => CanvasFlowNode[];
  getEdges: () => CanvasFlowEdge[];
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}): string {
  const nodes = args.getNodes();
  const mediaNode = nodes.find((n) => n.id === args.imageNodeId);
  if (!mediaNode || !DOCK_STYLE_MEDIA_TYPES.has(mediaNode.type ?? "")) {
    return "";
  }
  const mediaType = mediaNode.type ?? "";

  const patch = buildPro2StyleAssetNodeData(args.preset) as unknown as Record<
    string,
    unknown
  >;
  const existing = findStyleAssetLinkedToImage(
    nodes,
    args.getEdges(),
    args.imageNodeId,
  );

  if (existing) {
    args.updateNodeData(existing.id, patch);
    ensurePro2StyleAssetToMediaEdge(
      args.setEdges,
      existing.id,
      args.imageNodeId,
      mediaType,
    );
    applyPro2StyleDockPromptToImageIfEmpty(
      args.updateNodeData,
      args.getNodes,
      args.imageNodeId,
      existing.id,
    );
    const previewUrl = args.preset.imageUrl?.trim();
    if (previewUrl) {
      fitPro2StyleAssetNodeToPreviewImage(existing.id, previewUrl);
    }
    selectPro2NodeAfterSpawn(args.setNodes, existing.id);
    return existing.id;
  }

  const abs = absoluteNodePosition(mediaNode, nodes);
  const styleW = PRO2_STYLE_ASSET_NODE_WIDTH;
  const position = {
    x: abs.x - styleW - SNAP_GAP,
    y: abs.y,
  };

  const nodeId = args.addNode("story-pro2-style-asset", position, patch);
  if (!nodeId) return "";

  ensurePro2StyleAssetToMediaEdge(
    args.setEdges,
    nodeId,
    args.imageNodeId,
    mediaType,
  );
  applyPro2StyleDockPromptToImageIfEmpty(
    args.updateNodeData,
    args.getNodes,
    args.imageNodeId,
    nodeId,
  );
  const previewUrl = args.preset.imageUrl?.trim();
  if (previewUrl) {
    fitPro2StyleAssetNodeToPreviewImage(nodeId, previewUrl);
  }

  selectPro2NodeAfterSpawn(args.setNodes, nodeId);
  return nodeId;
}

const STYLE_DOCK_IMAGE_TARGETS = new Set([
  "story-pro2-image",
  "story-pro2-three-view",
  "sbv1-image",
]);

/** 手动画布连线 · 风格 → 图片时补 Dock 默认提示词 */
export function applyPro2StyleAssetEdgeConnection(args: {
  connection: Connection;
  nodes: CanvasFlowNode[];
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  getNodes: () => CanvasFlowNode[];
}): void {
  const source = args.nodes.find((n) => n.id === args.connection.source);
  const target = args.nodes.find((n) => n.id === args.connection.target);
  if (source?.type !== "story-pro2-style-asset" || !target?.type) return;
  if (!STYLE_DOCK_IMAGE_TARGETS.has(target.type)) return;
  applyPro2StyleDockPromptToImageIfEmpty(
    args.updateNodeData,
    args.getNodes,
    target.id,
    source.id,
  );
}
