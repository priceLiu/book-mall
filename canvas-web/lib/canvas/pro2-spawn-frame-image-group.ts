"use client";

import type { StoryProFrameRow } from "./story-pro-workspace-types";
import { buildPro2ImageNodeData } from "./pro2-spawn-nodes";
import {
  pro2MediaGridLayout,
  pro2MediaGridCols,
  pro2MediaChildSize,
  pro2MediaGroupOrigin,
  relayoutPro2MediaGroup,
} from "./pro2-media-group-layout";
import { ensurePro2HubToMediaGroupEdge } from "./pro2-hub-media-group-edge";
import { pickRuntimeImagePreviewUrl } from "./task-media-url";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { GROUP_COLOR_PRESETS } from "./types";

function frameRowPreview(row: StoryProFrameRow): {
  ossUrl?: string;
  uploading?: boolean;
  uploadError?: string;
} {
  const rt = row.runtime;
  const url =
    pickRuntimeImagePreviewUrl(rt, undefined) ||
    rt?.ossUrl ||
    rt?.ephemeralUrl;
  const uploading =
    rt?.status === "running" || rt?.status === "pending";
  return {
    ossUrl: url,
    uploading,
    uploadError: rt?.failMessage,
  };
}

function groupLabel(hubNodeId: string, nodes: CanvasFlowNode[]): string {
  const hubs = nodes.filter((n) => n.type === "story-pro2-script-hub");
  const idx = hubs.findIndex((h) => h.id === hubNodeId);
  return `分镜图 · 脚本 ${idx >= 0 ? idx + 1 : 1}`;
}

export type EnsurePro2FrameImageGroupArgs = {
  frameColumnId: string;
  hubNodeId: string;
  rows: StoryProFrameRow[];
  nodes: CanvasFlowNode[];
  addNode: (
    type: "story-pro2-image" | "group",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  addNodeInGroup: (
    type: "story-pro2-image",
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

/** 为分镜列生成/更新「组 + N 个图片子节点」视觉层 */
export function ensurePro2FrameImageGroup(
  args: EnsurePro2FrameImageGroupArgs,
): string | null {
  const frameNode = args.nodes.find((n) => n.id === args.frameColumnId);
  if (!frameNode) return null;

  const existingGroup = args.nodes.find(
    (n) =>
      n.type === "group" &&
      (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
        args.frameColumnId,
  );

  const sorted = [...args.rows].sort((a, b) => a.frameIndex - b.frameIndex);
  if (!sorted.length) {
    if (existingGroup?.id && args.setEdges) {
      ensurePro2HubToMediaGroupEdge(
        args.setEdges,
        args.hubNodeId,
        existingGroup.id,
      );
    }
    return existingGroup?.id ?? null;
  }

  const origin = pro2MediaGroupOrigin(args.nodes, args.hubNodeId);
  let groupId = existingGroup?.id;

  const childImages = args.nodes.filter(
    (n) =>
      n.type === "story-pro2-image" &&
      (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
        args.frameColumnId,
  );

  const newChildIds: string[] = [];
  const frameCell = pro2MediaChildSize({ pro2MediaRole: "frame" });
  const cols = pro2MediaGridCols(sorted.length);

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const preview = frameRowPreview(row);
    const label = `镜 ${row.frameIndex}`;
    const existing = childImages.find(
      (n) => (n.data as { pro2RowKey?: string }).pro2RowKey === row.key,
    );

    if (existing) {
      args.updateNodeData(existing.id, {
        label,
        dockInput: row.prompt ?? "",
        ...preview,
        pro2MediaRole: "frame",
        pro2RowKey: row.key,
        pro2HubNodeId: args.hubNodeId,
        pro2ControllerNodeId: args.frameColumnId,
        pro2GroupId: groupId,
      });
      newChildIds.push(existing.id);
      continue;
    }

    const rel = pro2MediaGridLayout(i, frameCell, cols);
    const data = {
      ...buildPro2ImageNodeData({ label }),
      dockInput: row.prompt ?? "",
      ...preview,
      pro2MediaRole: "frame",
      pro2RowKey: row.key,
      pro2HubNodeId: args.hubNodeId,
      pro2ControllerNodeId: args.frameColumnId,
    };

    if (groupId) {
      const id = args.addNodeInGroup("story-pro2-image", groupId, rel, data);
      if (id) newChildIds.push(id);
    } else {
      const abs = {
        x: origin.x + rel.x,
        y: origin.y + rel.y,
      };
      const id = args.addNode("story-pro2-image", abs, data);
      if (id) newChildIds.push(id);
    }
  }

  if (!newChildIds.length) return groupId ?? null;

  if (!groupId) {
    groupId =
      args.createGroupContaining(newChildIds, {
        label: groupLabel(args.hubNodeId, args.nodes),
        color: GROUP_COLOR_PRESETS[1],
      }) ?? undefined;
    if (groupId) {
      for (const cid of newChildIds) {
        args.updateNodeData(cid, { pro2GroupId: groupId });
      }
      args.updateNodeData(groupId, {
        pro2Kind: "frame-board",
        pro2HubNodeId: args.hubNodeId,
        pro2ControllerNodeId: args.frameColumnId,
      });
    }
  }

  args.updateNodeData(args.frameColumnId, {
    pro2VisualGroupId: groupId,
    hubNodeId: args.hubNodeId,
  });

  if (groupId) {
    relayoutPro2MediaGroup(args.setNodes, groupId);
    if (args.setEdges) {
      ensurePro2HubToMediaGroupEdge(args.setEdges, args.hubNodeId, groupId);
    }
  }

  return groupId ?? null;
}

/** 分镜列 rows 变更后同步到组内图片节点 */
export function syncPro2FrameImagesFromRows(
  nodes: CanvasFlowNode[],
  frameColumnId: string,
  rows: StoryProFrameRow[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  for (const row of rows) {
    const img = nodes.find(
      (n) =>
        n.type === "story-pro2-image" &&
        (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
          frameColumnId &&
        (n.data as { pro2RowKey?: string }).pro2RowKey === row.key,
    );
    if (!img) continue;
    const preview = frameRowPreview(row);
    updateNodeData(img.id, {
      label: `镜 ${row.frameIndex}`,
      dockInput: row.prompt ?? "",
      ...preview,
    });
  }
}
