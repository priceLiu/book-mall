"use client";

import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { findStoryPro2WorkspaceForStarter } from "./spawn-story-pro2-workspace";
import {
  STORY_PRO_FRAME_IMAGE_MODEL_KEYS,
  STORY_PRO_FRAME_IMAGE_SINGLE_REF_MODEL_KEYS,
} from "./story-prompts";
import { modelHasStoryCapabilities } from "./story-model-capabilities";
import { pickDefaultStoryImageEngine } from "./system-providers";
import { resolveStarterForHub } from "./story-workspace-resolver";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export type Pro2FrameBatchImagePick = {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
};

export const PRO2_FRAME_IMAGE_MODEL_KEYS: string[] = [
  ...STORY_PRO_FRAME_IMAGE_MODEL_KEYS,
  ...STORY_PRO_FRAME_IMAGE_SINGLE_REF_MODEL_KEYS.filter((k) =>
    modelHasStoryCapabilities(k, ["image_t2i"]),
  ),
];

const DEFAULT_IMAGE_PARAMS: Record<string, unknown> = {
  aspect_ratio: "16:9",
  resolution: "2K",
  output_format: "png",
};

export function pickDefaultPro2FrameImageEngine(
  providers: CanvasProviderDto[],
): Pro2FrameBatchImagePick | null {
  for (const provider of providers.filter((p) => p.active)) {
    for (const key of PRO2_FRAME_IMAGE_MODEL_KEYS) {
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

/** 从已存在的分镜图列读取 batchImage */
export function resolvePro2FrameBatchImageForHub(
  hubId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): Pro2FrameBatchImagePick | null {
  const starter = resolveStarterForHub(nodes, edges, hubId);
  if (!starter) return null;
  const ws = findStoryPro2WorkspaceForStarter(
    nodes,
    edges,
    starter.id,
    (starter.data as { workspaceIds?: StoryPro2WorkspaceIds }).workspaceIds,
  );
  const frameId = ws?.frameColumnId;
  if (!frameId) return null;
  const frame = nodes.find((n) => n.id === frameId);
  const batch = (
    frame?.data as
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
