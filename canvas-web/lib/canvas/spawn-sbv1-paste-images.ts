import { uploadCanvasImage } from "@/lib/canvas-api";
import { absoluteNodePosition } from "./normalize-graph-nodes";
import { normalizeCanvasImageFile } from "./normalize-canvas-image-file";
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
export async function spawnSbv1PastedImages(
  args: SpawnSbv1PasteImagesArgs,
): Promise<string[]> {
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
    // 与节点「点击/悬停粘贴上传」(LibtvImageNode.onFile) 对齐：
    // 预览用客户端规范化后的 blob（贴合内容、去透明留白）；
    // 上传仍用「原始字节」交服务端 sharp 处理，避免 canvas 重编码丢色彩/降质。
    let preview = raw;
    try {
      preview = await normalizeCanvasImageFile(raw);
    } catch {
      preview = raw;
    }
    const yOff = (existing + i) * (imgH + ROW_GAP);
    const pos = {
      x: anchorAbs.x - imgW - gap,
      y: anchorAbs.y + yOff,
    };
    const blobUrl = URL.createObjectURL(preview);
    const id = args.addNode("sbv1-image", pos, {
      blobUrl,
      uploading: true,
      dockInput: "",
      imageMode: "upload",
      label:
        (preview.name || raw.name).replace(/\.[^.]+$/, "") ||
        `图片 ${existing + i + 1}`,
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
    void uploadCanvasImage(args.base, raw)
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
  if (lastId && args.setNodes) {
    selectSbv1NodeAfterSpawn(args.setNodes, lastId);
  }
  return createdIds;
}

/** 图片节点 Dock · 多图粘贴/上传（连 in_image） */
export async function spawnSbv1ImageDockPastedImages(
  args: SpawnSbv1PasteImagesArgs,
): Promise<string[]> {
  return spawnSbv1PastedImages({
    ...args,
    targetHandle: "in_image",
    maxCount: args.maxCount ?? 12,
  });
}

/** 画布空白处粘贴多张图片（不连线） */
export async function spawnSbv1CanvasPastedImages(args: {
  files: File[];
  base: string;
  origin: { x: number; y: number };
  addNode: SpawnSbv1PasteImagesArgs["addNode"];
  updateNodeData: SpawnSbv1PasteImagesArgs["updateNodeData"];
}): Promise<string[]> {
  if (!args.base || !args.files.length) return [];
  const images = args.files.filter(
    (f) =>
      f.type.startsWith("image/") ||
      (!f.type && /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)),
  );
  const createdIds: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const raw = images[i]!;
    let preview = raw;
    try {
      preview = await normalizeCanvasImageFile(raw);
    } catch {
      preview = raw;
    }
    const blobUrl = URL.createObjectURL(preview);
    const id = args.addNode(
      "sbv1-image",
      { x: args.origin.x + i * 28, y: args.origin.y + i * 28 },
      {
        blobUrl,
        uploading: true,
        imageMode: "upload",
        label: (preview.name || raw.name).replace(/\.[^.]+$/, "") || `图片 ${i + 1}`,
      },
    );
    createdIds.push(id);
    void uploadCanvasImage(args.base, raw)
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
  return createdIds;
}
