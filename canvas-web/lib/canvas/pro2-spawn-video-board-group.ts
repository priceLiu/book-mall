"use client";

import type { StoryProFrameRow, StoryProVideoRow } from "./story-pro-workspace-types";
import { buildFrameRowScriptPrompt } from "./story-column-sync";
import {
  pro2MediaGridLayout,
  pro2MediaGridCols,
  pro2MediaChildSize,
  pro2MediaGroupOrigin,
  relayoutPro2MediaGroup,
} from "./pro2-media-group-layout";
import {
  ensurePro2FrameBoardToVideoBoardEdge,
  ensurePro2HubToMediaGroupEdge,
} from "./pro2-hub-media-group-edge";
import { resolvePro2FrameBoardGroupIdForVideoColumn } from "./pro2-video-board-dock-links";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { GROUP_COLOR_PRESETS } from "./types";

function videoRowPreview(row: StoryProVideoRow): {
  runtime?: StoryProVideoRow["videoRuntime"];
} {
  return { runtime: row.videoRuntime };
}

function groupLabel(hubNodeId: string, nodes: CanvasFlowNode[]): string {
  const hubs = nodes.filter((n) => n.type === "story-pro2-script-hub");
  const idx = hubs.findIndex((h) => h.id === hubNodeId);
  return `分镜视频 · 脚本 ${idx >= 0 ? idx + 1 : 1}`;
}

export type EnsurePro2VideoBoardGroupArgs = {
  videoColumnId: string;
  frameColumnId: string;
  hubNodeId: string;
  frameRows: StoryProFrameRow[];
  videoRows: StoryProVideoRow[];
  nodes: CanvasFlowNode[];
  addNode: (
    type: "sbv1-video-engine" | "group",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  addNodeInGroup: (
    type: "sbv1-video-engine",
    groupId: string,
    relativePosition: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  createGroupContaining: (
    childIds: string[],
    opts: { label: string; color: string },
  ) => string | null;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  setNodes: (fn: (n: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges?: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
};

/** 为视频列生成/更新「组 + N 个视频子节点」视觉层 */
export function ensurePro2VideoBoardGroup(
  args: EnsurePro2VideoBoardGroupArgs,
): string | null {
  const videoNode = args.nodes.find((n) => n.id === args.videoColumnId);
  if (!videoNode) return null;

  const existingGroup = args.nodes.find(
    (n) =>
      n.type === "group" &&
      (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
        args.videoColumnId,
  );

  const sorted = [...args.videoRows].sort((a, b) => a.frameIndex - b.frameIndex);
  if (!sorted.length) {
    if (existingGroup?.id && args.setEdges) {
      const frameGroupId = resolvePro2FrameBoardGroupIdForVideoColumn(
        args.videoColumnId,
        args.nodes,
      );
      if (frameGroupId) {
        ensurePro2FrameBoardToVideoBoardEdge(
          args.setEdges,
          frameGroupId,
          existingGroup.id,
        );
      }
    }
    return existingGroup?.id ?? null;
  }

  const origin = pro2MediaGroupOrigin(args.nodes, args.hubNodeId);
  let groupId = existingGroup?.id;

  const childVideos = args.nodes.filter(
    (n) =>
      n.type === "sbv1-video-engine" &&
      (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
        args.videoColumnId,
  );

  const newChildIds: string[] = [];
  const videoCell = pro2MediaChildSize({ pro2MediaRole: "video" });
  const cols = pro2MediaGridCols(sorted.length);

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const frameRow = args.frameRows.find(
      (f) => f.key === row.key || f.frameIndex === row.frameIndex,
    );
    const preview = videoRowPreview(row);
    const label = `镜 ${row.frameIndex}`;
    const prompt =
      row.videoPrompt?.trim() ||
      (frameRow ? buildFrameRowScriptPrompt(frameRow) : "");
    const existing = childVideos.find(
      (n) => (n.data as { pro2RowKey?: string }).pro2RowKey === row.key,
    );

    if (existing) {
      args.updateNodeData(existing.id, {
        label,
        dockInput: prompt,
        runtime: preview.runtime,
        pro2MediaRole: "video",
        pro2RowKey: row.key,
        pro2HubNodeId: args.hubNodeId,
        pro2ControllerNodeId: args.videoColumnId,
        pro2GroupId: groupId,
      });
      newChildIds.push(existing.id);
      continue;
    }

    const rel = pro2MediaGridLayout(i, videoCell, cols);
    const data = {
      label,
      dockInput: prompt,
      runtime: preview.runtime,
      pro2MediaRole: "video",
      pro2RowKey: row.key,
      pro2HubNodeId: args.hubNodeId,
      pro2ControllerNodeId: args.videoColumnId,
    };

    if (groupId) {
      const id = args.addNodeInGroup("sbv1-video-engine", groupId, rel, data);
      if (id) newChildIds.push(id);
    } else {
      const abs = { x: origin.x + rel.x, y: origin.y + rel.y };
      const id = args.addNode("sbv1-video-engine", abs, data);
      if (id) newChildIds.push(id);
    }
  }

  if (!newChildIds.length) return groupId ?? null;

  if (!groupId) {
    groupId =
      args.createGroupContaining(newChildIds, {
        label: groupLabel(args.hubNodeId, args.nodes),
        color: GROUP_COLOR_PRESETS[3] ?? GROUP_COLOR_PRESETS[2]!,
      }) ?? undefined;
    if (groupId) {
      for (const cid of newChildIds) {
        args.updateNodeData(cid, { pro2GroupId: groupId });
      }
      args.updateNodeData(groupId, {
        pro2Kind: "video-board",
        pro2HubNodeId: args.hubNodeId,
        pro2ControllerNodeId: args.videoColumnId,
      });
    }
  }

  args.updateNodeData(args.videoColumnId, {
    pro2VisualGroupId: groupId,
    hubNodeId: args.hubNodeId,
    frameColumnId: args.frameColumnId,
  });

  if (groupId) {
    relayoutPro2MediaGroup(args.setNodes, groupId, { resetOrigin: true });
    if (args.setEdges) {
      const frameGroupId = resolvePro2FrameBoardGroupIdForVideoColumn(
        args.videoColumnId,
        args.nodes,
      );
      if (frameGroupId) {
        ensurePro2FrameBoardToVideoBoardEdge(
          args.setEdges,
          frameGroupId,
          groupId,
        );
      }
    }
  }

  collapsePro2VideoColumnAnchor(args.setNodes, args.videoColumnId);

  return groupId ?? null;
}

/** 分镜图组格 → 视频组格 · 参考图连线 */
export function wirePro2VideoBoardRefEdges(
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void,
  nodes: CanvasFlowNode[],
  videoColumnId: string,
  frameColumnId: string,
): void {
  setEdges((prev) => {
    let next = prev;
    const videos = nodes.filter(
      (n) =>
        n.type === "sbv1-video-engine" &&
        (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
          videoColumnId,
    );
    for (const video of videos) {
      const rowKey = (video.data as { pro2RowKey?: string }).pro2RowKey;
      if (!rowKey) continue;
      const frameImg = nodes.find(
        (n) =>
          n.type === "story-pro2-image" &&
          (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
            frameColumnId &&
          (n.data as { pro2RowKey?: string }).pro2RowKey === rowKey,
      );
      if (!frameImg) continue;
      if (
        next.some(
          (e) =>
            e.source === frameImg.id &&
            e.target === video.id &&
            e.targetHandle === "in_ref",
        )
      ) {
        continue;
      }
      next = [
        ...next,
        {
          id: `e-${frameImg.id}-${video.id}-ref`,
          source: frameImg.id,
          target: video.id,
          sourceHandle: "out_image",
          targetHandle: "in_ref",
        },
      ];
    }
    return next;
  });
}

const PRO2_VISUAL_COLUMN_ANCHOR_SIZE = 1;

/** 分镜视频列 · 折叠为 1×1 数据锚点（视觉在 group 子节点） */
export function collapsePro2VideoColumnAnchor(
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
  videoColumnId: string,
): void {
  setNodes((nodes) =>
    nodes.map((n) => {
      if (n.id !== videoColumnId) return n;
      if (n.width === PRO2_VISUAL_COLUMN_ANCHOR_SIZE &&
          n.height === PRO2_VISUAL_COLUMN_ANCHOR_SIZE) {
        return n;
      }
      return {
        ...n,
        width: PRO2_VISUAL_COLUMN_ANCHOR_SIZE,
        height: PRO2_VISUAL_COLUMN_ANCHOR_SIZE,
        style: {
          ...(typeof n.style === "object" && n.style ? n.style : {}),
          width: PRO2_VISUAL_COLUMN_ANCHOR_SIZE,
          height: PRO2_VISUAL_COLUMN_ANCHOR_SIZE,
        },
      } as CanvasFlowNode;
    }),
  );
}

function pro2VideoBoardNeedsRepair(
  videoNode: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): boolean {
  const d = videoNode.data as {
    rows?: StoryProVideoRow[];
    hubNodeId?: string;
    frameColumnId?: string;
    pro2VisualGroupId?: string;
  };
  const rows = d.rows ?? [];
  if (!rows.length) return false;
  if (!d.hubNodeId?.trim() || !d.frameColumnId?.trim()) return false;

  const childVideos = nodes.filter(
    (n) =>
      n.type === "sbv1-video-engine" &&
      (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
        videoNode.id,
  );
  const groupId = d.pro2VisualGroupId?.trim();
  const group = groupId ? nodes.find((n) => n.id === groupId) : undefined;
  const groupByController = nodes.find(
    (n) =>
      n.type === "group" &&
      (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
        videoNode.id,
  );

  if (groupId && group && childVideos.length >= rows.length) return false;
  if (groupByController && childVideos.length >= rows.length) return false;

  const hasMediaAttempts = rows.some(
    (r) =>
      r.videoRuntime?.status ||
      r.videoRuntime?.ossUrl ||
      r.videoRuntime?.ephemeralUrl ||
      r.ttsRuntime?.status,
  );
  if (hasMediaAttempts || groupId || groupByController || childVideos.length > 0) {
    return true;
  }
  return false;
}

export type RepairPro2VideoBoardStore = {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: EnsurePro2VideoBoardGroupArgs["addNode"];
  addNodeInGroup: EnsurePro2VideoBoardGroupArgs["addNodeInGroup"];
  createGroupContaining: EnsurePro2VideoBoardGroupArgs["createGroupContaining"];
  updateNodeData: EnsurePro2VideoBoardGroupArgs["updateNodeData"];
  setNodes: EnsurePro2VideoBoardGroupArgs["setNodes"];
  setEdges: EnsurePro2VideoBoardGroupArgs["setEdges"];
};

/** hydrate / 旧列数据迁移 · 补齐「组 + sbv1-video-engine」视觉层 */
export function repairPro2VideoBoardVisualGroups(
  getStore: () => RepairPro2VideoBoardStore,
): void {
  const initial = getStore();
  const videoColumns = initial.nodes.filter((n) => n.type === "story-pro2-video");
  for (const col of videoColumns) {
    const store = getStore();
    const videoNode = store.nodes.find((n) => n.id === col.id);
    if (!videoNode) continue;

    const d = videoNode.data as {
      rows?: StoryProVideoRow[];
      hubNodeId?: string;
      frameColumnId?: string;
    };
    const rows = d.rows ?? [];
    if (!rows.length || !d.hubNodeId?.trim() || !d.frameColumnId?.trim()) {
      collapsePro2VideoColumnAnchor(store.setNodes, col.id);
      continue;
    }

    if (!pro2VideoBoardNeedsRepair(videoNode, store.nodes)) {
      collapsePro2VideoColumnAnchor(store.setNodes, col.id);
      continue;
    }

    const frameNode = store.nodes.find((n) => n.id === d.frameColumnId);
    const frameRows =
      ((frameNode?.data as { rows?: StoryProFrameRow[] })?.rows as
        | StoryProFrameRow[]
        | undefined) ?? [];

    ensurePro2VideoBoardGroup({
      videoColumnId: col.id,
      frameColumnId: d.frameColumnId,
      hubNodeId: d.hubNodeId,
      frameRows,
      videoRows: rows,
      nodes: store.nodes,
      addNode: store.addNode,
      addNodeInGroup: store.addNodeInGroup,
      createGroupContaining: store.createGroupContaining,
      updateNodeData: store.updateNodeData,
      setNodes: store.setNodes,
      setEdges: store.setEdges,
    });

    const after = getStore();
    wirePro2VideoBoardRefEdges(
      after.setEdges,
      after.nodes,
      col.id,
      d.frameColumnId,
    );
  }

  repairPro2VideoBoardGroupEdges(getStore);
}

/** 已有分镜视频组 · 修正 hub→组 为 分镜图组→组 */
export function repairPro2VideoBoardGroupEdges(
  getStore: () => RepairPro2VideoBoardStore,
): void {
  const { nodes, setEdges } = getStore();
  for (const group of nodes) {
    if (group.type !== "group") continue;
    const gd = group.data as { pro2Kind?: string; pro2ControllerNodeId?: string };
    if (gd.pro2Kind !== "video-board") continue;
    const videoColumnId = gd.pro2ControllerNodeId?.trim();
    if (!videoColumnId) continue;
    const frameGroupId = resolvePro2FrameBoardGroupIdForVideoColumn(
      videoColumnId,
      nodes,
    );
    if (!frameGroupId) continue;
    ensurePro2FrameBoardToVideoBoardEdge(setEdges, frameGroupId, group.id);
  }
}

/** 视频列 rows 变更后同步到组内 sbv1-video-engine 子节点 */
export function syncPro2VideoBoardFromRows(
  nodes: CanvasFlowNode[],
  videoColumnId: string,
  rows: StoryProVideoRow[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const videoNode = nodes.find((n) => n.id === videoColumnId);
  const syncGroupId =
    (videoNode?.data as { pro2VisualGroupId?: string })?.pro2VisualGroupId?.trim() ||
    (videoNode?.data as { pro2PendingSyncGroupId?: string })?.pro2PendingSyncGroupId?.trim();
  for (const row of rows) {
    const cell = nodes.find((n) => {
      if (n.type !== "sbv1-video-engine") return false;
      const d = n.data as {
        pro2ControllerNodeId?: string;
        pro2RowKey?: string;
        pro2GroupId?: string;
      };
      if (d.pro2ControllerNodeId !== videoColumnId) return false;
      if (d.pro2RowKey !== row.key) return false;
      if (!syncGroupId) return true;
      return d.pro2GroupId === syncGroupId;
    });
    if (!cell) continue;
    const preview = videoRowPreview(row);
    updateNodeData(cell.id, {
      label: `镜 ${row.frameIndex}`,
      dockInput: row.videoPrompt?.trim() || "",
      runtime: preview.runtime,
    });
  }
}
