"use client";

import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { findWorkspaceForColumnId } from "./story-column-display";
import { pickDefaultStoryImageEngine } from "./system-providers";
import type { CanvasEnginePick, CanvasFlowEdge, CanvasFlowNode } from "./types";
import type { StoryCharacterColumnNodeData } from "./story-workspace-types";

const DEFAULT_IMAGE_PARAMS = {
  aspect_ratio: "16:9",
  resolution: "2K",
  output_format: "png",
};

function columnHasImageEngine(
  d: { batchImage?: CanvasEnginePick } | undefined,
): boolean {
  return Boolean(
    d?.batchImage?.providerId?.trim() && d?.batchImage?.modelKey?.trim(),
  );
}

/**
 * 为漫剧/专业版媒体列补齐默认 IMAGE 模型（多工作流按 columnId → hub 隔离）。
 * 分镜列可继承同套角色列已选模型。
 */
export function ensureStoryColumnImageEngineDefault(args: {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  columnId: string;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  providers: CanvasProviderDto[];
}): void {
  const col = args.nodes.find((n) => n.id === args.columnId);
  if (!col) return;
  const t = col.type ?? "";
  const isChar =
    t === "story-character-column" || t === "story-pro-character";
  const isScene = t === "story-pro-scene";
  const isFrame =
    t === "story-frame-column" || t === "story-pro-frame";
  if (!isChar && !isScene && !isFrame) return;

  const d = col.data as { batchImage?: CanvasEnginePick };
  if (columnHasImageEngine(d)) return;

  const ws = findWorkspaceForColumnId(args.nodes, args.edges, args.columnId);
  if (isFrame && ws?.characterColumnId) {
    const char = args.nodes.find((n) => n.id === ws.characterColumnId);
    const charBatch = (char?.data as StoryCharacterColumnNodeData | undefined)
      ?.batchImage;
    if (columnHasImageEngine({ batchImage: charBatch })) {
      args.updateNodeData(args.columnId, {
        batchImage: {
          providerId: charBatch!.providerId,
          modelKey: charBatch!.modelKey,
          params: charBatch!.params ?? DEFAULT_IMAGE_PARAMS,
        },
      });
      return;
    }
  }

  const pick = pickDefaultStoryImageEngine(args.providers);
  if (!pick) return;
  args.updateNodeData(args.columnId, {
    batchImage: {
      providerId: pick.providerId,
      modelKey: pick.modelKey,
      params: DEFAULT_IMAGE_PARAMS,
    },
  });
}
