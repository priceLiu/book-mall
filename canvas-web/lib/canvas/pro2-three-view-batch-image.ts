"use client";

import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { SBV1_IMAGE_MODEL_KEYS, buildSbv1ImageEngineParams } from "./sbv1-image-models";
import { findStoryPro2WorkspaceForStarter } from "./spawn-story-pro2-workspace";
import { pickDefaultPro2CharacterImageEngine } from "./pro2-three-view-engine";
import { resolveStarterForHub } from "./story-workspace-resolver";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export type Pro2ThreeViewBatchImagePick = {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
};

/** @deprecated Pro2 三视图 UI 与 2.0 图片节点一致，见 PRO2_CHARACTER_IMAGE_MODEL_KEYS */
export const PRO2_THREE_VIEW_MODEL_KEYS: string[] = [...SBV1_IMAGE_MODEL_KEYS];

export function pickDefaultPro2ThreeViewImageEngine(
  providers: CanvasProviderDto[],
): Pro2ThreeViewBatchImagePick | null {
  return pickDefaultPro2CharacterImageEngine(providers);
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
    params: batch.params ?? buildSbv1ImageEngineParams({ aspectRatio: "16:9", resolution: "2K" }),
  };
}
