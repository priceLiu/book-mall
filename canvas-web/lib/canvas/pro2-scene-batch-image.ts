"use client";

import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { findStoryPro2WorkspaceForStarter } from "./spawn-story-pro2-workspace";
import { pickDefaultStoryImageEngine } from "./system-providers";
import { resolveStarterForHub } from "./story-workspace-resolver";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import {
  PRO2_THREE_VIEW_MODEL_KEYS,
  pickDefaultPro2ThreeViewImageEngine,
  type Pro2ThreeViewBatchImagePick,
} from "./pro2-three-view-batch-image";

export type Pro2SceneBatchImagePick = Pro2ThreeViewBatchImagePick;

export const PRO2_SCENE_IMAGE_MODEL_KEYS: string[] = [...PRO2_THREE_VIEW_MODEL_KEYS];

const DEFAULT_IMAGE_PARAMS: Record<string, unknown> = {
  aspect_ratio: "16:9",
  resolution: "2K",
  output_format: "png",
};

export function pickDefaultPro2SceneImageEngine(
  providers: CanvasProviderDto[],
): Pro2SceneBatchImagePick | null {
  const fromThreeView = pickDefaultPro2ThreeViewImageEngine(providers);
  if (fromThreeView) return fromThreeView;
  const fallback = pickDefaultStoryImageEngine(providers);
  if (!fallback) return null;
  return { ...fallback, params: { ...DEFAULT_IMAGE_PARAMS } };
}

/** 从脚本 hub（或遗留场景设计列）读取 batchImage */
export function resolvePro2SceneBatchImageForHub(
  hubId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): Pro2SceneBatchImagePick | null {
  const hub = nodes.find((n) => n.id === hubId);
  const fromHub = (
    hub?.data as
      | {
          sceneBatchImage?: {
            providerId?: string;
            modelKey?: string;
            params?: Record<string, unknown>;
          };
        }
      | undefined
  )?.sceneBatchImage;
  if (fromHub?.providerId?.trim() && fromHub.modelKey?.trim()) {
    return {
      providerId: fromHub.providerId,
      modelKey: fromHub.modelKey,
      params: fromHub.params ?? { ...DEFAULT_IMAGE_PARAMS },
    };
  }

  const starter = resolveStarterForHub(nodes, edges, hubId);
  if (!starter) return null;
  const ws = findStoryPro2WorkspaceForStarter(
    nodes,
    edges,
    starter.id,
    (starter.data as { workspaceIds?: StoryPro2WorkspaceIds }).workspaceIds,
  );
  const sceneId = ws?.sceneColumnId;
  if (sceneId) {
    const col = nodes.find((n) => n.id === sceneId);
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
    if (batch?.providerId?.trim() && batch.modelKey?.trim()) {
      return {
        providerId: batch.providerId,
        modelKey: batch.modelKey,
        params: batch.params ?? { ...DEFAULT_IMAGE_PARAMS },
      };
    }
  }

  return null;
}