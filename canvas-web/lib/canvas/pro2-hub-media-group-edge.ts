"use client";

import { isPro2FrameBoardGroup } from "./pro2-resolve-frame-board-group";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

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

/** 脚本中枢 → 组内媒体节点（hub text → 子节点 in_image），不再连组容器。 */
export function ensurePro2HubToMediaGroupChildEdges(
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void,
  hubNodeId: string,
  groupId: string,
  childNodeIds: string[],
  opts?: { sourceHandle?: string; targetHandle?: string },
): void {
  const sourceHandle = opts?.sourceHandle ?? "text";
  const targetHandle = opts?.targetHandle ?? "in_image";
  const childIds = [...new Set(childNodeIds.filter(Boolean))];
  if (!childIds.length) return;

  setEdges((prev) => {
    const withoutGroupInbound = prev.filter(
      (e) =>
        !(
          e.source === hubNodeId &&
          e.target === groupId &&
          e.sourceHandle === sourceHandle &&
          e.targetHandle === "in_text"
        ),
    );
    const next = [...withoutGroupInbound];
    for (const childId of childIds) {
      if (
        next.some(
          (e) =>
            e.source === hubNodeId &&
            e.target === childId &&
            e.sourceHandle === sourceHandle &&
            (e.targetHandle === targetHandle ||
              e.targetHandle === "in_text" ||
              e.targetHandle === "default"),
        )
      ) {
        continue;
      }
      next.push({
        id: `e-${hubNodeId}-${childId}-${sourceHandle}`,
        source: hubNodeId,
        target: childId,
        sourceHandle,
        targetHandle,
      });
    }
    return next;
  });
}

function isPro2MediaBoardGroup(
  group: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): boolean {
  if (group.type !== "group") return false;
  const kind = (group.data as { pro2Kind?: string }).pro2Kind;
  if (
    kind === "character-board" ||
    kind === "scene-board" ||
    kind === "frame-board"
  ) {
    return true;
  }
  if (isPro2FrameBoardGroup(group, nodes)) return true;
  return nodes.some((n) => {
    if (n.parentId !== group.id) return false;
    if (n.type === "story-pro2-three-view") return true;
    if (n.type !== "story-pro2-image") return false;
    const role = (n.data as { pro2MediaRole?: string }).pro2MediaRole;
    return role === "scene" || role === "frame" || role === "character-three-view";
  });
}

/** 打开/保存画布：hub → 组容器 改为 hub → 组内媒体子节点 */
export function migratePro2HubMediaGroupEdgesToChildren(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowEdge[] {
  let next = edges;
  for (const group of nodes) {
    if (!isPro2MediaBoardGroup(group, nodes)) continue;
    const hubId = (group.data as { pro2HubNodeId?: string }).pro2HubNodeId?.trim();
    if (!hubId || !nodes.some((n) => n.id === hubId)) continue;
    const childIds = nodes
      .filter((n) => n.parentId === group.id)
      .map((n) => n.id);
    if (!childIds.length) continue;
    ensurePro2HubToMediaGroupChildEdges(
      (fn) => {
        next = fn(next);
      },
      hubId,
      group.id,
      childIds,
    );
  }
  return next;
}
