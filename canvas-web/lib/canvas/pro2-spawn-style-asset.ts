"use client";

import type { StyleLibraryPreset } from "./style-library/catalog";
import { styleLibraryPickerDefaults } from "./style-library/category-pickers";
import type { StoryPro2StyleAssetNodeData } from "./story-pro2-workspace-types";
import {
  buildPro2StyleAssetToHubEdge,
  findPro2StyleAssetSnapScriptHub,
} from "./pro2-style-asset-connect";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { PRO2_SCRIPT_NODE_WIDTH } from "./story-pro2-node-chrome";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { flowPositionAtViewportCenter } from "./viewport-placement";

const SNAP_GAP = 48;

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

  return nodeId;
}
