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
  loadImageNaturalSize,
  type LibtvMediaNodeSize,
} from "./libtv-media-node-auto-fit";
import { gridSplitCropRegion } from "./libtv-grid-split-crop";
import { LIBTV_MEDIA_FIT_VERSION, LIBTV_IMAGE_NODE_HEADER_HEIGHT } from "./libtv-node-chrome";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { GROUP_COLOR_PRESETS } from "./types";
import {
  cropGridSplitCell,
  type GridSplitCrop,
} from "./libtv-grid-split-crop";
import { PRO2_IMAGE_NODE_WIDTH, PRO2_IMAGE_NODE_HEIGHT } from "./story-pro2-node-chrome";
import type { LibtvImageGridSplitState } from "./libtv-image-grid-split-dimensions";
import {
  hdResolutionForScale,
  hdScaleLabel,
  hdUpscaleDockPrompt,
  type LibtvGridHdScaleId,
} from "./libtv-grid-split-hd";
import type { Sbv1ImageNodeData } from "./sbv1-workspace-types";
import type { StoryRefImage } from "./story-ref-image";
import { resolveHdGridSplitImageInputs } from "./resolve-hd-grid-split-image-inputs";

export type { GridSplitCrop } from "./libtv-grid-split-crop";
export type {
  LibtvGridSplitPresetId,
  LibtvImageGridSplitState,
} from "./libtv-image-grid-split-dimensions";
export {
  LIBTV_GRID_SPLIT_MAX,
  LIBTV_GRID_SPLIT_MIN,
  LIBTV_GRID_SPLIT_PRESETS,
  libtvGridSplitFromDimensions,
  libtvGridSplitFromPreset,
  toggleGridSplitCell,
} from "./libtv-image-grid-split-dimensions";

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

/** 服务端裁切优先 HTTPS 原图；本地 blob 在提交时再上传 */
function gridSplitSourceUrlForServer(sourceData: {
  ossUrl?: string;
  blobUrl?: string;
  runtime?: { ephemeralUrl?: string };
}): string | undefined {
  const oss = sourceData.ossUrl?.trim();
  if (oss && /^https?:\/\//.test(oss)) return oss;
  const ephemeral = sourceData.runtime?.ephemeralUrl?.trim();
  if (ephemeral && /^https?:\/\//.test(ephemeral)) return ephemeral;
  const blob = sourceData.blobUrl?.trim();
  return blob || undefined;
}

function computeGridCellNodeSizeFromNatural(
  imgW: number,
  imgH: number,
  crop: GridSplitCrop,
): LibtvMediaNodeSize {
  const region = gridSplitCropRegion(crop);
  const cellW = Math.max(1, imgW * region.w);
  const cellH = Math.max(1, imgH * region.h);
  return computeLibtvMediaNodeSize(cellW, cellH, "square-image");
}

function estimateGridCellNodeSize(
  source: CanvasFlowNode,
  split: LibtvImageGridSplitState,
  cellIndex: number,
): LibtvMediaNodeSize {
  const crop = buildGridSplitCrop(source.id, split, cellIndex);
  const frameW = source.width ?? PRO2_IMAGE_NODE_WIDTH;
  const frameH = source.height ?? PRO2_IMAGE_NODE_HEIGHT;
  const stageW = Math.max(1, frameW);
  const stageH = Math.max(1, frameH - LIBTV_IMAGE_NODE_HEADER_HEIGHT);
  const cellNw = stageW / Math.max(1, split.cols);
  const cellNh = stageH / Math.max(1, split.rows);
  return computeGridCellNodeSizeFromNatural(
    cellNw * split.cols,
    cellNh * split.rows,
    crop,
  );
}

function scheduleHdGridSplitNodeSizeBackfill(
  store: GridSplitExpandStore,
  sourceNodeId: string,
  split: LibtvImageGridSplitState,
  sourceUrl: string,
  nodeIds: string[],
): void {
  if (!nodeIds.length) return;
  void (async () => {
    try {
      const { w, h } = await loadImageNaturalSize(sourceUrl);
      const sizes = split.selected.map((cellIndex) =>
        computeGridCellNodeSizeFromNatural(
          w,
          h,
          buildGridSplitCrop(sourceNodeId, split, cellIndex),
        ),
      );
      store.setNodes((prev) =>
        prev.map((n) => {
          const idx = nodeIds.indexOf(n.id);
          if (idx < 0) return n;
          const size = sizes[idx]!;
          return {
            ...n,
            width: size.width,
            height: size.height,
            style: {
              ...(n.style ?? {}),
              width: size.width,
              height: size.height,
            },
          };
        }),
      );
      relayoutSpawnedHdNodes(
        store.setNodes,
        sourceNodeId,
        nodeIds,
        store.getNodes,
      );
    } catch {
      /* 保留 spawn 时的估算尺寸 */
    }
  })();
}

function applyHdGridSplitPlaceholderNode(
  setNodes: GridSplitFrameGroupStore["setNodes"],
  nodeId: string,
  refId: string,
  sourceUrl: string,
  sourceData: { ossUrl?: string; blobUrl?: string },
  crop: GridSplitCrop,
  size: LibtvMediaNodeSize,
  dockInput: string,
): void {
  const previewUrl = gridSplitSourceUrl(sourceData) ?? sourceUrl;
  const dockRefImages: StoryRefImage[] = [
    { id: refId, label: "参考图", url: previewUrl, gridSplitCrop: crop },
  ];
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
              dockInput,
              dockRefImages,
              gridSplitCrop: crop,
              gridSplitSourceUrl: sourceUrl,
              imageMode: "img2img",
              pro2HdFromGridSplit: true,
              gridSplitFrameCrop: false,
              mediaFit: true,
              mediaFitKey: `grid-split-hd|${sourceUrl}|${crop.col}|${crop.row}|${crop.cols}|${crop.rows}`,
              mediaFitVersion: LIBTV_MEDIA_FIT_VERSION,
            },
          }
        : n,
    ),
  );
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

/** 宫格批量 spawn · 按实际节点尺寸网格排布（避免重叠） */
function layoutGridSplitSpawnPositions(
  source: CanvasFlowNode,
  sizes: LibtvMediaNodeSize[],
): { x: number; y: number }[] {
  const count = sizes.length;
  if (!count) return [];
  const cols = pro2MediaGridCols(count);
  const rows = Math.ceil(count / cols);
  const gap = SPAWN_GAP;

  const colWidths = Array.from({ length: cols }, (_, col) => {
    let maxW = 0;
    for (let row = 0; row < rows; row++) {
      const idx = row * cols + col;
      if (idx >= count) continue;
      maxW = Math.max(maxW, sizes[idx]!.width);
    }
    return maxW;
  });

  const rowHeights = Array.from({ length: rows }, (_, row) => {
    let maxH = 0;
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (idx >= count) continue;
      maxH = Math.max(maxH, sizes[idx]!.height);
    }
    return maxH;
  });

  const sourceW = source.width ?? PRO2_IMAGE_NODE_WIDTH;
  const originX = source.position.x + sourceW + gap;
  const originY = source.position.y;

  return sizes.map((_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    let x = originX;
    for (let c = 0; c < col; c++) x += colWidths[c]! + gap;
    let y = originY;
    for (let r = 0; r < row; r++) y += rowHeights[r]! + gap;
    return { x, y };
  });
}

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
  getNodes?: () => CanvasFlowNode[];
  addNode: GridSplitFrameGroupStore["addNode"];
  setNodes: GridSplitFrameGroupStore["setNodes"];
  setEdges: GridSplitFrameGroupStore["setEdges"];
  base?: string;
  projectId?: string;
  updateNodeData?: (id: string, patch: Record<string, unknown>) => void;
};

/** spawn 后后台服务端裁切（顺序执行，预览与提交共用 OSS，避免 CSS 精灵串格） */
function scheduleHdGridSplitServerCropBackfill(
  store: GridSplitExpandStore,
  sourceUrl: string,
  entries: { nodeId: string; crop: GridSplitCrop }[],
): void {
  const { base, projectId, updateNodeData } = store;
  if (!base || !projectId || !updateNodeData || !entries.length) return;

  void (async () => {
    for (const { nodeId, crop } of entries) {
      try {
        await resolveHdGridSplitImageInputs(
          base,
          projectId,
          nodeId,
          {
            pro2HdFromGridSplit: true,
            gridSplitCrop: crop,
            gridSplitSourceUrl: sourceUrl,
          },
          updateNodeData,
        );
      } catch {
        /* 生成时 run-queue 仍会重试裁切 */
      }
    }
  })();
}

function relayoutSpawnedHdNodes(
  setNodes: GridSplitFrameGroupStore["setNodes"],
  sourceNodeId: string,
  newIds: string[],
  getNodes?: () => CanvasFlowNode[],
): void {
  if (!newIds.length) return;
  setNodes((prev) => {
    const nodes = getNodes?.() ?? prev;
    const source = nodes.find((n) => n.id === sourceNodeId);
    if (!source) return prev;

    const spawned = newIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is CanvasFlowNode => Boolean(n));
    if (!spawned.length) return prev;

    const sizes = spawned.map((n) => ({
      width:
        (typeof n.width === "number" ? n.width : undefined) ??
        (n.style as { width?: number } | undefined)?.width ??
        PRO2_IMAGE_NODE_WIDTH,
      height:
        (typeof n.height === "number" ? n.height : undefined) ??
        (n.style as { height?: number } | undefined)?.height ??
        PRO2_IMAGE_NODE_WIDTH,
    }));
    const positions = layoutGridSplitSpawnPositions(source, sizes);
    const posById = new Map(newIds.map((id, i) => [id, positions[i]!]));

    return prev.map((n) => {
      const pos = posById.get(n.id);
      if (!pos) return n;
      return { ...n, position: pos };
    });
  });
}

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

/** 选中宫格 · 生成高清图（即时建节点 + 连线；裁切在提交时由服务端完成） */
export function spawnHdImageFromGridSplit(
  sourceNodeId: string,
  split: LibtvImageGridSplitState,
  scaleId: LibtvGridHdScaleId,
  store: GridSplitExpandStore,
): { nodeIds: string[]; runnableIds: string[] } {
  if (!split.selected.length) return { nodeIds: [], runnableIds: [] };

  const readNodes = () => store.getNodes?.() ?? store.nodes;
  const source = readNodes().find((n) => n.id === sourceNodeId);
  if (!source) return { nodeIds: [], runnableIds: [] };

  const sourceData = source.data as Sbv1ImageNodeData;
  const sourceUrl = gridSplitSourceUrlForServer(sourceData);
  if (!sourceUrl) return { nodeIds: [], runnableIds: [] };

  const scaleLabel = hdScaleLabel(scaleId);
  const dockInput = hdUpscaleDockPrompt(scaleId);
  const cellSizes = split.selected.map((cellIndex) =>
    estimateGridCellNodeSize(source, split, cellIndex),
  );
  const positions = layoutGridSplitSpawnPositions(source, cellSizes);

  const nodeIds: string[] = [];
  const runnableIds: string[] = [];
  const cropEntries: { nodeId: string; crop: GridSplitCrop }[] = [];

  for (let i = 0; i < split.selected.length; i++) {
    const cellIndex = split.selected[i]!;
    const crop = buildGridSplitCrop(sourceNodeId, split, cellIndex);
    const pos = positions[i] ?? spawnPositionRightOf(source, i);
    const newId = store.addNode("story-pro2-image", pos, {
      ...buildPro2ImageNodeData({
        label:
          split.selected.length > 1
            ? `高清 ${scaleLabel} ${i + 1}`
            : `高清 ${scaleLabel}`,
        dockInput,
        imageMode: "img2img",
        resolution: hdResolutionForScale(scaleId),
        imageQuality: "high",
        engine: sourceData.engine,
        aspectRatio: "auto",
        outputCount: sourceData.outputCount ?? 1,
        pro2HubNodeId: sourceNodeId,
        pro2HdFromGridSplit: true,
      }),
    });
    if (!newId) continue;

    nodeIds.push(newId);
    runnableIds.push(newId);
    cropEntries.push({ nodeId: newId, crop });

    const refId = `hd-ref-${newId}`;
    const cellSize = cellSizes[i]!;
    applyHdGridSplitPlaceholderNode(
      store.setNodes,
      newId,
      refId,
      sourceUrl,
      sourceData,
      crop,
      cellSize,
      dockInput,
    );

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
  }

  relayoutSpawnedHdNodes(store.setNodes, sourceNodeId, nodeIds, store.getNodes);
  scheduleHdGridSplitNodeSizeBackfill(
    store,
    sourceNodeId,
    split,
    sourceUrl,
    nodeIds,
  );
  scheduleHdGridSplitServerCropBackfill(store, sourceUrl, cropEntries);

  const lastId = nodeIds[nodeIds.length - 1];
  if (lastId) selectPro2NodeAfterSpawn(store.setNodes, lastId);
  return { nodeIds, runnableIds };
}
