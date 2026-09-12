"use client";

import { isPro2FrameBoardGroup } from "./pro2-resolve-frame-board-group";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

function isPro2ScriptHubNode(
  node: CanvasFlowNode | undefined,
): node is CanvasFlowNode {
  return node?.type === "story-pro2-script-hub";
}

/** 同一对端点已有 media 入边（如宫格源图 image→in_image）时勿再补 hub text 边 */
function hasPro2HubMediaInboundEdge(
  edges: CanvasFlowEdge[],
  hubNodeId: string,
  childId: string,
): boolean {
  return edges.some(
    (e) =>
      e.source === hubNodeId &&
      e.target === childId &&
      (e.targetHandle === "in_image" ||
        e.targetHandle === "in_text" ||
        e.targetHandle === "default"),
  );
}

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
        hasPro2HubMediaInboundEdge(next, hubNodeId, childId) ||
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
    if (next.length === prev.length && next.every((e, i) => e === prev[i])) {
      return prev;
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

/**
 * 宫格分镜组误把源图当 pro2HubNodeId 时，hydrate 会补 text→in_image 与 image→in_image 重复，
 * 点击组内节点触发 RF setEdges 死循环。移除非 script-hub 的多余 text 边。
 */
export function stripSpuriousPro2HubTextEdges(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowEdge[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  let changed = false;
  const next = edges.filter((e) => {
    if (e.sourceHandle !== "text" || e.targetHandle !== "in_image") return true;
    const hub = nodeById.get(e.source);
    if (isPro2ScriptHubNode(hub)) return true;
    const hasImageParallel = edges.some(
      (o) =>
        o.id !== e.id &&
        o.source === e.source &&
        o.target === e.target &&
        o.sourceHandle === "image",
    );
    if (hasImageParallel) {
      changed = true;
      return false;
    }
    return true;
  });
  return changed ? next : edges;
}

/** 打开/保存画布：hub → 组容器 改为 hub → 组内媒体子节点（仅 script hub） */
export function migratePro2HubMediaGroupEdgesToChildren(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowEdge[] {
  let next = stripSpuriousPro2HubTextEdges(nodes, edges);
  for (const group of nodes) {
    if (!isPro2MediaBoardGroup(group, nodes)) continue;
    const hubId = (group.data as { pro2HubNodeId?: string }).pro2HubNodeId?.trim();
    if (!hubId) continue;
    const hub = nodes.find((n) => n.id === hubId);
    if (!isPro2ScriptHubNode(hub)) continue;
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
