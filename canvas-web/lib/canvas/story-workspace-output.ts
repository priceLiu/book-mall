"use client";

import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { batchRunStoryRowsSequential } from "./batch-run-nodes";
import {
  pickDefaultStoryImageEngine,
  pickDefaultStoryVideoEngine,
} from "./system-providers";
import type {
  StoryCharacterColumnNodeData,
  StoryFrameColumnNodeData,
  StoryVideoColumnNodeData,
  StoryWorkspaceIds,
} from "./story-workspace-types";
import type { CanvasEnginePick, CanvasFlowNode } from "./types";

const DEFAULT_IMAGE_PARAMS = {
  aspect_ratio: "16:9",
  resolution: "2K",
  output_format: "png",
};

/** 输出工作流后 · 为各列写入默认 IMAGE / VIDEO 模型（若尚未配置） */
export function applyDefaultStoryColumnEngines(
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  nodes: CanvasFlowNode[],
  ids: StoryWorkspaceIds,
  providers: CanvasProviderDto[],
): void {
  const imagePick = pickDefaultStoryImageEngine(providers);
  const videoPick = pickDefaultStoryVideoEngine(providers);
  const imageBatch: CanvasEnginePick | undefined = imagePick
    ? {
        providerId: imagePick.providerId,
        modelKey: imagePick.modelKey,
        params: DEFAULT_IMAGE_PARAMS,
      }
    : undefined;
  const videoBatch: CanvasEnginePick | undefined = videoPick
    ? {
        providerId: videoPick.providerId,
        modelKey: videoPick.modelKey,
        params: {},
      }
    : undefined;

  const char = nodes.find((n) => n.id === ids.characterColumnId);
  const frame = nodes.find((n) => n.id === ids.frameColumnId);
  const video = nodes.find((n) => n.id === ids.videoColumnId);

  if (char && imageBatch) {
    const d = char.data as unknown as StoryCharacterColumnNodeData;
    if (!d.batchImage?.providerId?.trim()) {
      updateNodeData(char.id, { batchImage: imageBatch });
    }
  }
  if (frame && imageBatch) {
    const d = frame.data as unknown as StoryFrameColumnNodeData;
    if (!d.batchImage?.providerId?.trim()) {
      updateNodeData(frame.id, { batchImage: imageBatch });
    }
  }
  if (video && videoBatch) {
    const d = video.data as unknown as StoryVideoColumnNodeData;
    if (!d.batchVideo?.providerId?.trim()) {
      updateNodeData(video.id, { batchVideo: videoBatch });
    }
  }
}

/** 输出工作流后 · 并行 enqueue 三视图 / 分镜图 / 分镜视频生成 */
export function kickoffStoryWorkspaceMediaRuns(
  nodes: CanvasFlowNode[],
  ids: StoryWorkspaceIds,
): void {
  const charCol = nodes.find((n) => n.id === ids.characterColumnId);
  const frameCol = nodes.find((n) => n.id === ids.frameColumnId);
  const videoCol = nodes.find((n) => n.id === ids.videoColumnId);

  const charData = charCol?.data as unknown as
    | StoryCharacterColumnNodeData
    | undefined;
  const frameData = frameCol?.data as unknown as StoryFrameColumnNodeData | undefined;
  const videoData = videoCol?.data as unknown as StoryVideoColumnNodeData | undefined;

  const charKeys = (charData?.rows ?? []).map((r) => r.key);
  const frameKeys = (frameData?.rows ?? []).map((r) => r.key);
  const videoKeys = (videoData?.rows ?? []).map((r) => r.key);

  window.setTimeout(() => {
    if (
      charCol &&
      charKeys.length &&
      charData?.batchImage?.providerId?.trim()
    ) {
      batchRunStoryRowsSequential(charCol.id, charKeys, "threeView");
    }
    if (
      frameCol &&
      frameKeys.length &&
      frameData?.batchImage?.providerId?.trim()
    ) {
      batchRunStoryRowsSequential(frameCol.id, frameKeys, "frameImage");
    }
    const videoBatch =
      videoData?.batchVideo ??
      frameData?.batchVideo ??
      frameData?.batchImage;
    if (
      videoCol &&
      videoKeys.length &&
      videoBatch?.providerId?.trim()
    ) {
      batchRunStoryRowsSequential(videoCol.id, videoKeys, "video");
    }
  }, 0);
}
