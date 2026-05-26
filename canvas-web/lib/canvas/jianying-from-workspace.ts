import type { CanvasFlowNode } from "./types";
import type { StoryFrameColumnNodeData, StoryVideoColumnNodeData } from "./story-workspace-types";

export type JianyingFrameExport = {
  frameIndex: number;
  videoUrl?: string;
  audioUrl?: string;
  dialogue?: string;
};

export function collectJianyingFramesFromWorkspace(
  nodes: CanvasFlowNode[],
): JianyingFrameExport[] {
  const frameCol = nodes.find((n) => n.type === "story-frame-column");
  const videoCol = nodes.find((n) => n.type === "story-video-column");
  if (!frameCol && !videoCol) return [];

  const frameRows = (frameCol?.data as StoryFrameColumnNodeData)?.rows ?? [];
  const videoRows = (videoCol?.data as StoryVideoColumnNodeData)?.rows ?? [];
  const indices = new Set<number>();
  for (const r of frameRows) indices.add(r.frameIndex);
  for (const r of videoRows) indices.add(r.frameIndex);

  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((frameIndex) => {
      const fr = frameRows.find((r) => r.frameIndex === frameIndex);
      const vr = videoRows.find((r) => r.frameIndex === frameIndex);
      return {
        frameIndex,
        videoUrl:
          vr?.videoRuntime?.ossUrl ??
          vr?.videoRuntime?.ephemeralUrl ??
          undefined,
        audioUrl:
          vr?.ttsRuntime?.ossUrl ?? vr?.ttsRuntime?.ephemeralUrl ?? undefined,
        dialogue: fr?.dialogue ?? vr?.dialogue,
      };
    })
    .filter((f) => f.videoUrl || f.audioUrl);
}
