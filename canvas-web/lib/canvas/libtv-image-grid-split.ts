"use client";

import { nanoid } from "nanoid";
import { buildPro2ImageNodeData } from "./pro2-spawn-nodes";
import {
  pro2MediaGridCols,
  pro2MediaGridLayout,
  pro2MediaChildSize,
  pro2MediaGroupOrigin,
  relayoutPro2MediaGroup,
} from "./pro2-media-group-layout";
import {
  computeLibtvMediaNodeSize,
  LIBTV_MEDIA_FIT_VERSION,
} from "./libtv-media-node-auto-fit";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { GROUP_COLOR_PRESETS } from "./types";
import {
  cropGridSplitCell,
  type GridSplitCrop,
} from "./libtv-grid-split-crop";
import { PRO2_IMAGE_NODE_WIDTH } from "./story-pro2-node-chrome";

export type { GridSplitCrop } from "./libtv-grid-split-crop";

export type LibtvGridSplitPresetId = "2x2" | "3x3" | "4x4" | "5x5";

export type LibtvImageGridSplitState = {
  cols: number;
  rows: number;
  selected: number[];
};

export const LIBTV_GRID_SPLIT_PRESETS: {
  id: LibtvGridSplitPresetId;
  label: string;
  cols: number;
  rows: number;
}[] = [
  { id: "2x2", label: "4宫格 (2×2)", cols: 2, rows: 2 },
  { id: "3x3", label: "9宫格 (3×3)", cols: 3, rows: 3 },
  { id: "4x4", label: "16宫格 (4×4)", cols: 4, rows: 4 },
  { id: "5x5", label: "25宫格 (5×5)", cols: 5, rows: 5 },
];

export function libtvGridSplitFromPreset(
  presetId: LibtvGridSplitPresetId,
): LibtvImageGridSplitState {
  const preset = LIBTV_GRID_SPLIT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return { cols: 3, rows: 3, selected: [] };
  return { cols: preset.cols, rows: preset.rows, selected: [] };
}

export function toggleGridSplitCell(
  state: LibtvImageGridSplitState,
  cellIndex: number,
): LibtvImageGridSplitState {
  const selected = state.selected.includes(cellIndex)
    ? state.selected.filter((i) => i !== cellIndex)
    : [...state.selected, cellIndex].sort((a, b) => a - b);
  return { ...state, selected };
}

export type GridSplitFrameGroupStore = {
  nodes: CanvasFlowNode[];
  addNode: (
    type: "story-pro2-image" | "group",
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  addNodeInGroup: (
    type: "story-pro2-image",
    groupId: string,
    relativePosition: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  createGroupContaining: (
    childIds: string[],
    opts: { label: string; color: string },
  ) => string | null;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
};

function cellRowCol(index: number, cols: number): { row: number; col: number } {
  return { row: Math.floor(index / cols), col: index % cols };
}

function buildGridSplitCrop(
  sourceNodeId: string,
  split: LibtvImageGridSplitState,
  cellIndex: number,
): GridSplitCrop {
  const { row, col } = cellRowCol(cellIndex, split.cols);
  return {
    sourceNodeId,
    cols: split.cols,
    rows: split.rows,
    col,
    row,
  };
}

function gridSplitSourceUrl(sourceData: {
  ossUrl?: string;
  blobUrl?: string;
}): string | undefined {
  const blob = sourceData.blobUrl?.trim();
  const oss = sourceData.ossUrl?.trim();
  return blob || oss || undefined;
}

function applyCroppedFrameNode(
  setNodes: GridSplitFrameGroupStore["setNodes"],
  nodeId: string,
  blobUrl: string,
  cellWidth: number,
  cellHeight: number,
): void {
  const size = computeLibtvMediaNodeSize(cellWidth, cellHeight, "square-image");
  setNodes((prev) =>
    prev.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            width: size.width,
            height: size.height,
            style: {
              ...(n.style ?? {}),
              width: size.width,
              height: size.height,
            },
            data: {
              ...n.data,
              blobUrl,
              ossUrl: undefined,
              gridSplitCrop: undefined,
              gridSplitFrameCrop: true,
              mediaFit: true,
              mediaFitKey: blobUrl,
              mediaFitVersion: LIBTV_MEDIA_FIT_VERSION,
            },
          }
        : n,
    ),
  );
}

function applyGridSplitFallback(
  setNodes: GridSplitFrameGroupStore["setNodes"],
  nodeId: string,
  sourceData: { ossUrl?: string; blobUrl?: string },
  crop: GridSplitCrop,
): void {
  const ossUrl = sourceData.ossUrl?.trim();
  const blobUrl = sourceData.blobUrl?.trim();
  setNodes((prev) =>
    prev.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            data: {
              ...n.data,
              ossUrl: ossUrl || undefined,
              blobUrl: blobUrl || undefined,
              gridSplitCrop: crop,
            },
          }
        : n,
    ),
  );
}

const SPAWN_GAP = 48;

function spawnPositionRightOf(
  source: CanvasFlowNode,
  index: number,
): { x: number; y: number } {
  const w = source.width ?? PRO2_IMAGE_NODE_WIDTH;
  return {
    x: source.position.x + w + SPAWN_GAP,
    y: source.position.y + index * 32,
  };
}

/** 选中宫格 · 创建分镜图组（真实裁切 + 按单元比例自适应节点） */
export async function spawnFrameGroupFromGridSplit(
  sourceNodeId: string,
  split: LibtvImageGridSplitState,
  store: GridSplitFrameGroupStore,
): Promise<string | null> {
  if (!split.selected.length) return null;

  const source = store.nodes.find((n) => n.id === sourceNodeId);
  if (!source) return null;

  const sourceData = source.data as {
    ossUrl?: string;
    blobUrl?: string;
  };
  const sourceUrl = gridSplitSourceUrl(sourceData);
  if (!sourceUrl) return null;

  const childIds: string[] = [];
  const frameCell = pro2MediaChildSize({ pro2MediaRole: "frame" });
  const cols = pro2MediaGridCols(split.selected.length);
  const origin = pro2MediaGroupOrigin(store.nodes, sourceNodeId);

  const spawnEntries = split.selected.map((cellIndex, i) => ({
    cellIndex,
    i,
    crop: buildGridSplitCrop(sourceNodeId, split, cellIndex),
    rel: pro2MediaGridLayout(i, frameCell, cols),
    label: `镜 ${i + 1}`,
  }));

  const croppedCells = await Promise.all(
    spawnEntries.map(async ({ crop }) => {
      try {
        return await cropGridSplitCell(sourceUrl, crop);
      } catch {
        return null;
      }
    }),
  );

  for (let i = 0; i < spawnEntries.length; i++) {
    const entry = spawnEntries[i]!;
    const cropped = croppedCells[i];
    const id = store.addNode(
      "story-pro2-image",
      { x: origin.x + entry.rel.x, y: origin.y + entry.rel.y },
      {
        ...buildPro2ImageNodeData({
          label: entry.label,
          pro2MediaRole: "frame",
        }),
        pro2HubNodeId: sourceNodeId,
      },
    );
    if (!id) continue;

    if (cropped) {
      applyCroppedFrameNode(
        store.setNodes,
        id,
        cropped.blobUrl,
        cropped.cellWidth,
        cropped.cellHeight,
      );
    } else {
      applyGridSplitFallback(store.setNodes, id, sourceData, entry.crop);
    }
    childIds.push(id);
  }

  if (!childIds.length) return null;

  const groupId = store.createGroupContaining(childIds, {
    label: "分镜图",
    color: GROUP_COLOR_PRESETS[1],
  });
  if (!groupId) return null;

  for (const cid of childIds) {
    store.updateNodeData(cid, { pro2GroupId: groupId });
    store.setEdges((prev) => [
      ...prev,
      {
        id: `e-${nanoid(6)}`,
        source: sourceNodeId,
        target: cid,
        sourceHandle: "image",
        targetHandle: "in_image",
      },
    ]);
  }

  store.updateNodeData(groupId, {
    pro2Kind: "frame-board",
    pro2Styled: true,
    pro2HubNodeId: sourceNodeId,
  });

  relayoutPro2MediaGroup(store.setNodes, groupId, { resetOrigin: true });
  selectPro2NodeAfterSpawn(store.setNodes, groupId);
  return groupId;
}

export type GridSplitExpandStore = {
  nodes: CanvasFlowNode[];
  addNode: GridSplitFrameGroupStore["addNode"];
  setNodes: GridSplitFrameGroupStore["setNodes"];
  setEdges: GridSplitFrameGroupStore["setEdges"];
};

/** 选中宫格 · 扩图（真实裁切 + 自适应节点） */
export async function spawnExpandImageFromGridSplit(
  sourceNodeId: string,
  split: LibtvImageGridSplitState,
  store: GridSplitExpandStore,
): Promise<string[]> {
  if (!split.selected.length) return [];

  const source = store.nodes.find((n) => n.id === sourceNodeId);
  if (!source) return [];

  const sourceData = source.data as { ossUrl?: string; blobUrl?: string };
  const sourceUrl = gridSplitSourceUrl(sourceData);
  if (!sourceUrl) return [];

  const newIds: string[] = [];

  for (let i = 0; i < split.selected.length; i++) {
    const cellIndex = split.selected[i]!;
    const crop = buildGridSplitCrop(sourceNodeId, split, cellIndex);
    const pos = spawnPositionRightOf(source, i);
    const newId = store.addNode("story-pro2-image", pos, {
      ...buildPro2ImageNodeData({ label: "扩图" }),
      pro2HubNodeId: sourceNodeId,
    });
    if (!newId) continue;

    try {
      const cropped = await cropGridSplitCell(sourceUrl, crop);
      applyCroppedFrameNode(
        store.setNodes,
        newId,
        cropped.blobUrl,
        cropped.cellWidth,
        cropped.cellHeight,
      );
    } catch {
      applyGridSplitFallback(store.setNodes, newId, sourceData, crop);
    }

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
    newIds.push(newId);
  }

  const lastId = newIds[newIds.length - 1];
  if (lastId) selectPro2NodeAfterSpawn(store.setNodes, lastId);
  return newIds;
}
