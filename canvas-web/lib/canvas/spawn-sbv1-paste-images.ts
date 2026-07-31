import {
  canvasImagePreviewLabel,
  scheduleCanvasImageUpload,
} from "@/lib/canvas/canvas-image-preview-upload";
import { absoluteNodePosition } from "./normalize-graph-nodes";
import { selectSbv1NodeAfterSpawn } from "./sbv1-spawn-nodes";
import {
  SBV1_IMAGE_NODE_HEIGHT,
  SBV1_IMAGE_NODE_WIDTH,
} from "./sbv1-node-chrome";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";

const ROW_GAP = 28;

function countImagePredecessors(
  anchorId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): number {
  return edges.filter((e) => {
    if (e.target !== anchorId) return false;
    const src = nodes.find((n) => n.id === e.source);
    return src?.type === "sbv1-image";
  }).length;
}

export type SpawnSbv1PasteImagesArgs = {
  anchorNodeId: string;
  files: File[];
  base: string;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type: CanvasNodeType,
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  setNodes?: (
    fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[],
  ) => void;
  maxCount?: number;
  /** 图片 Dock 连 `in_image`；视频合成 Dock 连 `in_ref` */
  targetHandle?: "in_image" | "in_ref";
};

/** 画布 / 引擎 dock 多图粘贴：在锚点左侧生成 sbv1-image 并连线 */
export function spawnSbv1PastedImages(
  args: SpawnSbv1PasteImagesArgs,
): string[] {
  const anchor = args.nodes.find((n) => n.id === args.anchorNodeId);
  if (!anchor || !args.base || !args.files.length) return [];

  const images = args.files.filter(
    (f) =>
      f.type.startsWith("image/") ||
      (!f.type && /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)),
  );
  if (!images.length) return [];

  const max = args.maxCount ?? 9;
  const targetHandle = args.targetHandle ?? "in_ref";
  const existing = countImagePredecessors(
    args.anchorNodeId,
    args.nodes,
    args.edges,
  );
  const room = Math.max(0, max - existing);
  const batch = images.slice(0, room);
  if (!batch.length) return [];

  const gap = 48;
  const imgW = SBV1_IMAGE_NODE_WIDTH;
  const imgH = SBV1_IMAGE_NODE_HEIGHT;
  const anchorAbs = absoluteNodePosition(anchor, args.nodes);
  const createdIds: string[] = [];

  for (let i = 0; i < batch.length; i++) {
    const raw = batch[i]!;
    const yOff = (existing + i) * (imgH + ROW_GAP);
    const pos = {
      x: anchorAbs.x - imgW - gap,
      y: anchorAbs.y + yOff,
    };
    const blobUrl = URL.createObjectURL(raw);
    const label = canvasImagePreviewLabel(raw, `图片 ${existing + i + 1}`);
    const id = args.addNode("sbv1-image", pos, {
      blobUrl,
      uploading: true,
      dockInput: "",
      imageMode: "upload",
      label,
    });
    createdIds.push(id);
    args.setEdges((es) => [
      ...es,
      {
        id: `e_${id}_${args.anchorNodeId}_${Date.now()}_${i}`,
        source: id,
        target: args.anchorNodeId,
        sourceHandle: "image",
        targetHandle,
        animated: false,
      },
    ]);
    scheduleCanvasImageUpload({
      nodeId: id,
      file: raw,
      base: args.base,
      updateNodeData: args.updateNodeData,
      previewBlobUrl: blobUrl,
    });
  }
  const lastId = createdIds[createdIds.length - 1];
  if (lastId && args.setNodes) {
    selectSbv1NodeAfterSpawn(args.setNodes, lastId);
  }
  return createdIds;
}

/** 图片节点 Dock · 多图粘贴/上传（连 in_image） */
export function spawnSbv1ImageDockPastedImages(
  args: SpawnSbv1PasteImagesArgs,
): string[] {
  return spawnSbv1PastedImages({
    ...args,
    targetHandle: "in_image",
    maxCount: args.maxCount ?? 12,
  });
}

/** 画布空白处粘贴多张图片（不连线） */
export function spawnSbv1CanvasPastedImages(args: {
  files: File[];
  base: string;
  origin: { x: number; y: number };
  addNode: SpawnSbv1PasteImagesArgs["addNode"];
  updateNodeData: SpawnSbv1PasteImagesArgs["updateNodeData"];
}): string[] {
  if (!args.base || !args.files.length) return [];
  const images = args.files.filter(
    (f) =>
      f.type.startsWith("image/") ||
      (!f.type && /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)),
  );
  const createdIds: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const raw = images[i]!;
    const blobUrl = URL.createObjectURL(raw);
    const label = canvasImagePreviewLabel(raw, `图片 ${i + 1}`);
    const id = args.addNode(
      "sbv1-image",
      { x: args.origin.x + i * 28, y: args.origin.y + i * 28 },
      {
        blobUrl,
        uploading: true,
        imageMode: "upload",
        label,
      },
    );
    createdIds.push(id);
    scheduleCanvasImageUpload({
      nodeId: id,
      file: raw,
      base: args.base,
      updateNodeData: args.updateNodeData,
      previewBlobUrl: blobUrl,
    });
  }
  return createdIds;
}
