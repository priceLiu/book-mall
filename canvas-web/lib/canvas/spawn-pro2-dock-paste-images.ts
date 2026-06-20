import { uploadCanvasImage } from "@/lib/canvas-api";
import { normalizeCanvasImageFile } from "@/lib/canvas/normalize-canvas-image-file";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import {
  PRO2_IMAGE_NODE_HEIGHT,
  PRO2_IMAGE_NODE_WIDTH,
} from "./story-pro2-node-chrome";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";

const ROW_GAP = 28;

function edgeHandles(anchorType: string): {
  sourceHandle: string;
  targetHandle: string;
} {
  if (anchorType === "story-pro2-image") {
    return { sourceHandle: "image", targetHandle: "in_image" };
  }
  return { sourceHandle: "image", targetHandle: "in_text" };
}

function countImagePredecessors(
  anchorId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): number {
  return edges.filter((e) => {
    if (e.target !== anchorId) return false;
    const src = nodes.find((n) => n.id === e.source);
    return src?.type === "story-pro2-image";
  }).length;
}

export type SpawnPro2DockPasteImagesArgs = {
  anchorNodeId: string;
  anchorNodeType: string;
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
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  maxCount?: number;
};

/** Dock 多图粘贴/上传：在锚点节点左侧生成图片节点并连线 */
export async function spawnPro2DockPastedImages(
  args: SpawnPro2DockPasteImagesArgs,
): Promise<string[]> {
  const anchor = args.nodes.find((n) => n.id === args.anchorNodeId);
  if (!anchor || !args.base || !args.files.length) return [];

  const images = args.files.filter(
    (f) =>
      f.size > 0 &&
      (f.type.startsWith("image/") ||
        (!f.type && /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(f.name)) ||
        (!f.type && f.size > 0)),
  );
  if (!images.length) return [];

  const max = args.maxCount ?? 12;
  const existing = countImagePredecessors(
    args.anchorNodeId,
    args.nodes,
    args.edges,
  );
  const room = Math.max(0, max - existing);
  const batch = images.slice(0, room);
  if (!batch.length) return [];

  const gap = 48;
  const imgW = PRO2_IMAGE_NODE_WIDTH;
  const imgH = PRO2_IMAGE_NODE_HEIGHT;
  const { sourceHandle, targetHandle } = edgeHandles(args.anchorNodeType);
  const createdIds: string[] = [];

  for (let i = 0; i < batch.length; i++) {
    const file = batch[i]!;
    let normalized: File;
    try {
      normalized = await normalizeCanvasImageFile(file);
    } catch (e) {
      const label =
        file.name.replace(/\.[^.]+$/, "") || `参考图 ${existing + i + 1}`;
      const x = anchor.position.x - imgW - gap;
      const y = anchor.position.y + (existing + i) * (imgH * 0.38 + ROW_GAP);
      const newId = args.addNode("story-pro2-image", { x, y }, {
        label,
        dockInput: "",
        uploadError: e instanceof Error ? e.message : String(e),
      });
      if (newId) createdIds.push(newId);
      continue;
    }
    const blobUrl = URL.createObjectURL(normalized);
    const label =
      normalized.name.replace(/\.[^.]+$/, "") || `参考图 ${existing + i + 1}`;
    const x = anchor.position.x - imgW - gap;
    const y = anchor.position.y + (existing + i) * (imgH * 0.38 + ROW_GAP);

    const newId = args.addNode("story-pro2-image", { x, y }, {
      label,
      dockInput: "",
      blobUrl,
      uploading: true,
    });
    if (!newId) continue;

    createdIds.push(newId);
    args.setEdges((prev) => {
      if (
        prev.some(
          (e) =>
            e.source === newId &&
            e.target === args.anchorNodeId &&
            e.targetHandle === targetHandle,
        )
      ) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `e-${newId}-${args.anchorNodeId}-${Date.now()}-${i}`,
          source: newId,
          target: args.anchorNodeId,
          sourceHandle,
          targetHandle,
          animated: false,
        },
      ];
    });

    try {
      const ossUrl = await uploadCanvasImage(args.base, file);
      args.updateNodeData(newId, { ossUrl, uploading: false, label });
    } catch (e) {
      args.updateNodeData(newId, {
        uploading: false,
        uploadError: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const lastId = createdIds[createdIds.length - 1];
  if (lastId) {
    selectPro2NodeAfterSpawn(args.setNodes, lastId);
  }

  return createdIds;
}

/** 画布空白处粘贴多张图片（不连线） */
export async function spawnPro2CanvasPastedImages(args: {
  files: File[];
  base: string;
  origin: { x: number; y: number };
  addNode: SpawnPro2DockPasteImagesArgs["addNode"];
  updateNodeData: SpawnPro2DockPasteImagesArgs["updateNodeData"];
  setNodes: SpawnPro2DockPasteImagesArgs["setNodes"];
}): Promise<string[]> {
  if (!args.base || !args.files.length) return [];
  const images = args.files.filter(
    (f) =>
      f.size > 0 &&
      (f.type.startsWith("image/") ||
        (!f.type && /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(f.name)) ||
        (!f.type && f.size > 0)),
  );
  const createdIds: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const file = images[i]!;
    let normalized: File;
    try {
      normalized = await normalizeCanvasImageFile(file);
    } catch (e) {
      const id = args.addNode(
        "story-pro2-image",
        { x: args.origin.x + i * 28, y: args.origin.y + i * 28 },
        {
          uploading: false,
          uploadError: e instanceof Error ? e.message : String(e),
          label: file.name.replace(/\.[^.]+$/, "") || `图片 ${i + 1}`,
        },
      );
      createdIds.push(id);
      continue;
    }
    const blobUrl = URL.createObjectURL(normalized);
    const id = args.addNode(
      "story-pro2-image",
      { x: args.origin.x + i * 28, y: args.origin.y + i * 28 },
      {
        blobUrl,
        uploading: true,
        label: normalized.name.replace(/\.[^.]+$/, "") || `图片 ${i + 1}`,
      },
    );
    createdIds.push(id);
      void uploadCanvasImage(args.base, file)
      .then((ossUrl) => {
        args.updateNodeData(id, { ossUrl, uploading: false });
      })
      .catch((e) => {
        args.updateNodeData(id, {
          uploading: false,
          uploadError: e instanceof Error ? e.message : String(e),
        });
      });
  }
  const lastId = createdIds[createdIds.length - 1];
  if (lastId) {
    selectPro2NodeAfterSpawn(args.setNodes, lastId);
  }
  return createdIds;
}
