import type { CanvasFlowNode } from "./types";
import type {
  StoryFrameColumnNodeData,
  StoryVideoColumnNodeData,
  StoryWorkspaceIds,
} from "./story-workspace-types";

export type JianyingFrameExport = {
  frameIndex: number;
  videoUrl?: string;
  audioUrl?: string;
  dialogue?: string;
};

export function collectJianyingFramesFromWorkspace(
  nodes: CanvasFlowNode[],
  ws: Pick<StoryWorkspaceIds, "frameColumnId" | "videoColumnId">,
): JianyingFrameExport[] {
  const frameCol = ws.frameColumnId
    ? nodes.find((n) => n.id === ws.frameColumnId)
    : undefined;
  const videoCol = ws.videoColumnId
    ? nodes.find((n) => n.id === ws.videoColumnId)
    : undefined;
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
