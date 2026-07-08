"use client";

import type { CanvasFlowEdge } from "./types";

/** 分镜图组 → 分镜视频组（frame 组 out_media → video 组 in_text） */
export function ensurePro2FrameBoardToVideoBoardEdge(
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void,
  frameGroupId: string,
  videoGroupId: string,
): void {
  setEdges((prev) => {
    const withoutHubToVideo = prev.filter(
      (e) =>
        !(
          e.target === videoGroupId &&
          e.targetHandle === "in_text" &&
          e.source !== frameGroupId
        ),
    );
    if (
      withoutHubToVideo.some(
        (e) =>
          e.source === frameGroupId &&
          e.target === videoGroupId &&
          e.targetHandle === "in_text",
      )
    ) {
      return withoutHubToVideo;
    }
    return [
      ...withoutHubToVideo,
      {
        id: `e-${frameGroupId}-${videoGroupId}-frame-video`,
        source: frameGroupId,
        target: videoGroupId,
        sourceHandle: "out_media",
        targetHandle: "in_text",
      },
    ];
  });
}

/** 脚本中枢 → 媒体组容器连线（hub 右侧 text → 组左侧 in_text） */
export function ensurePro2HubToMediaGroupEdge(
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void,
  hubNodeId: string,
  groupId: string,
): void {
  setEdges((prev) => {
    if (
      prev.some(
        (e) =>
          e.source === hubNodeId &&
          e.target === groupId &&
          e.sourceHandle === "text" &&
          e.targetHandle === "in_text",
      )
    ) {
      return prev;
    }
    return [
      ...prev,
      {
        id: `e-${hubNodeId}-${groupId}`,
        source: hubNodeId,
        target: groupId,
        sourceHandle: "text",
        targetHandle: "in_text",
      },
    ];
  });
}
