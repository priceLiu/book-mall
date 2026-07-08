"use client";

import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { findStoryPro2WorkspaceForStarter } from "./spawn-story-pro2-workspace";
import { pickDefaultStoryVideoEngine } from "./system-providers";
import { STORY_PRO_VIDEO_MODEL_KEYS } from "./story-prompts";
import { resolveStarterForHub } from "./story-workspace-resolver";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export type Pro2VideoBatchVideoPick = {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
};

export const PRO2_VIDEO_MODEL_KEYS: string[] = [...STORY_PRO_VIDEO_MODEL_KEYS];

const DEFAULT_VIDEO_PARAMS: Record<string, unknown> = {
  duration: 5,
  resolution: "720p",
};

export function pickDefaultPro2VideoEngine(
  providers: CanvasProviderDto[],
): Pro2VideoBatchVideoPick | null {
  const fallback = pickDefaultStoryVideoEngine(providers);
  if (!fallback) return null;
  return { ...fallback, params: { ...DEFAULT_VIDEO_PARAMS } };
}

export function resolvePro2VideoBatchVideoForHub(
  hubId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): Pro2VideoBatchVideoPick | null {
  const starter = resolveStarterForHub(nodes, edges, hubId);
  if (!starter) return null;
  const ws = findStoryPro2WorkspaceForStarter(
    nodes,
    edges,
    starter.id,
    (starter.data as { workspaceIds?: StoryPro2WorkspaceIds }).workspaceIds,
  );
  const videoId = ws?.videoColumnId;
  if (!videoId) return null;
  const video = nodes.find((n) => n.id === videoId);
  const batch = (
    video?.data as
      | {
          batchVideo?: {
            providerId?: string;
            modelKey?: string;
            params?: Record<string, unknown>;
          };
        }
      | undefined
  )?.batchVideo;
  if (!batch?.providerId?.trim() || !batch.modelKey?.trim()) return null;
  return {
    providerId: batch.providerId,
    modelKey: batch.modelKey,
    params: batch.params ?? { ...DEFAULT_VIDEO_PARAMS },
  };
}
