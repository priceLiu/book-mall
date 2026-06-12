"use client";

import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { THREE_VIEW_ENGINE_MODEL_KEYS } from "./builtin-prompt-templates";
import { findStoryPro2WorkspaceForStarter } from "./spawn-story-pro2-workspace";
import { pickDefaultStoryImageEngine } from "./system-providers";
import { resolveStarterForHub } from "./story-workspace-resolver";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export type Pro2ThreeViewBatchImagePick = {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
};

export const PRO2_THREE_VIEW_MODEL_KEYS: string[] = [
  ...THREE_VIEW_ENGINE_MODEL_KEYS,
];

const DEFAULT_IMAGE_PARAMS: Record<string, unknown> = {
  aspect_ratio: "16:9",
  resolution: "2K",
  output_format: "png",
};

export function pickDefaultPro2ThreeViewImageEngine(
  providers: CanvasProviderDto[],
): Pro2ThreeViewBatchImagePick | null {
  for (const provider of providers.filter((p) => p.active)) {
    for (const key of PRO2_THREE_VIEW_MODEL_KEYS) {
      const model = provider.models.find(
        (m) => m.role === "IMAGE" && m.enabled && m.modelKey === key,
      );
      if (model) {
        return {
          providerId: provider.id,
          modelKey: model.modelKey,
          params: { ...DEFAULT_IMAGE_PARAMS },
        };
      }
    }
  }
  const fallback = pickDefaultStoryImageEngine(providers);
  if (!fallback) return null;
  return { ...fallback, params: { ...DEFAULT_IMAGE_PARAMS } };
}

/** 从已存在的人物设计列读取 batchImage */
export function resolvePro2ThreeViewBatchImageForHub(
  hubId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): Pro2ThreeViewBatchImagePick | null {
  const starter = resolveStarterForHub(nodes, edges, hubId);
  if (!starter) return null;
  const ws = findStoryPro2WorkspaceForStarter(
    nodes,
    edges,
    starter.id,
    (starter.data as { workspaceIds?: StoryPro2WorkspaceIds }).workspaceIds,
  );
  const charId = ws?.characterColumnId;
  if (!charId) return null;
  const col = nodes.find((n) => n.id === charId);
  const batch = (
    col?.data as
      | {
          batchImage?: {
            providerId?: string;
            modelKey?: string;
            params?: Record<string, unknown>;
          };
        }
      | undefined
  )?.batchImage;
  if (!batch?.providerId?.trim() || !batch.modelKey?.trim()) return null;
  return {
    providerId: batch.providerId,
    modelKey: batch.modelKey,
    params: batch.params ?? { ...DEFAULT_IMAGE_PARAMS },
  };
}
