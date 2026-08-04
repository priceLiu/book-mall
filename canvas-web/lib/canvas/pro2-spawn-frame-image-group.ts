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
import { ensurePro2HubToMediaGroupChildEdges } from "./pro2-hub-media-group-edge";
import { pickRuntimeImagePreviewUrl } from "./task-media-url";
import { isPro2FrameBoardGroup } from "./pro2-resolve-frame-board-group";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { GROUP_COLOR_PRESETS } from "./types";
import {
  findPro2FrameImageNodeForRow,
  resolveFrameSyncGroupId,
} from "./pro2-group-row-resolve";
import { filterPro2RowsForSpawn } from "./pro2-media-row-spawn";

export {
  findPro2FrameImageNodeForRow,
  resolveFrameSyncGroupId,
} from "./pro2-group-row-resolve";

function frameRowPreview(row: StoryProFrameRow): {
  ossUrl?: string;
  uploading?: boolean;
  uploadError?: string;
  runtime?: StoryProFrameRow["runtime"];
} {
  const rt = row.runtime;
  const inflight = rt?.status === "running" || rt?.status === "pending";
  const url = inflight
    ? undefined
    : pickRuntimeImagePreviewUrl(rt, undefined) ||
      rt?.ossUrl ||
      rt?.ephemeralUrl;
  return {
    ossUrl: url,
    uploading: inflight,
    uploadError: rt?.status === "error" ? rt?.failMessage : undefined,
    runtime: inflight ? rt : undefined,
  };
}

function groupLabel(
  hubNodeId: string,
  nodes: CanvasFlowNode[],
  spawnNewGroup?: boolean,
): string {
  const hubs = nodes.filter((n) => n.type === "story-pro2-script-hub");
  const idx = hubs.findIndex((h) => h.id === hubNodeId);
  const base = `分镜图 · 脚本 ${idx >= 0 ? idx + 1 : 1}`;
  if (!spawnNewGroup) return base;
  const existing = nodes.filter(
    (n) =>
      n.type === "group" &&
      (n.data as { pro2HubNodeId?: string }).pro2HubNodeId === hubNodeId &&
      isPro2FrameBoardGroup(n, nodes),
  ).length;
  return existing > 0 ? `${base} (${existing + 1})` : base;
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
  /** 已有分镜组时追加新组（不覆盖主组） */
  spawnNewGroup?: boolean;
  /** 仅 spawn 这些 rowKey 对应节点 */
  rowKeys?: string[];
};

/** 为分镜列生成/更新「组 + N 个图片子节点」视觉层 */
export function ensurePro2FrameImageGroup(
  args: EnsurePro2FrameImageGroupArgs,
): string | null {
  const frameNode = args.nodes.find((n) => n.id === args.frameColumnId);
  if (!frameNode) return null;

  const spawnNew = Boolean(args.spawnNewGroup);

  const existingGroup = spawnNew
    ? undefined
    : args.nodes.find(
        (n) =>
          n.type === "group" &&
          (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
            args.frameColumnId,
      );

  const sorted = [...filterPro2RowsForSpawn(args.rows, args.rowKeys)].sort(
    (a, b) => a.frameIndex - b.frameIndex,
  );
  if (!sorted.length) {
    if (existingGroup?.id && args.setEdges) {
      const childIds = args.nodes
        .filter(
          (n) =>
            n.type === "story-pro2-image" &&
            (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
              args.frameColumnId &&
            n.parentId === existingGroup!.id,
        )
        .map((n) => n.id);
      ensurePro2HubToMediaGroupChildEdges(
        args.setEdges,
        args.hubNodeId,
        existingGroup.id,
        childIds,
      );
    }
    return existingGroup?.id ?? null;
  }

  const origin = pro2MediaGroupOrigin(args.nodes, args.hubNodeId);
  let groupId = existingGroup?.id;

  if (spawnNew && !groupId) {
    const shellId = args.addNode("group", origin, {
      __t: "group",
      label: groupLabel(args.hubNodeId, args.nodes, true),
      color: GROUP_COLOR_PRESETS[1],
      pro2Kind: "frame-board",
      pro2HubNodeId: args.hubNodeId,
      pro2ControllerNodeId: args.frameColumnId,
    });
    if (shellId) {
      groupId = shellId;
      args.updateNodeData(args.frameColumnId, {
        pro2PendingSyncGroupId: groupId,
        hubNodeId: args.hubNodeId,
      });
    }
  }

  const childImages = spawnNew
    ? []
    : args.nodes.filter(
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
    const preview = spawnNew ? {} : frameRowPreview(row);
    const label = `镜 ${row.frameIndex}`;
    const existing = spawnNew
      ? undefined
      : childImages.find(
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
      pro2GroupId: groupId,
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

  if (!newChildIds.length) {
    if (spawnNew && groupId) {
      args.setNodes((prev) => prev.filter((n) => n.id !== groupId));
      args.updateNodeData(args.frameColumnId, {
        pro2PendingSyncGroupId: undefined,
      });
    }
    return spawnNew ? null : groupId ?? null;
  }

  if (!groupId) {
    groupId =
      args.createGroupContaining(newChildIds, {
        label: groupLabel(args.hubNodeId, args.nodes, spawnNew),
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
  } else if (spawnNew) {
    args.updateNodeData(groupId, {
      pro2Kind: "frame-board",
      pro2HubNodeId: args.hubNodeId,
      pro2ControllerNodeId: args.frameColumnId,
      label: groupLabel(args.hubNodeId, args.nodes, spawnNew),
    });
  }

  const framePatch: Record<string, unknown> = {
    hubNodeId: args.hubNodeId,
  };
  if (spawnNew && groupId) {
    framePatch.pro2PendingSyncGroupId = groupId;
  } else if (groupId) {
    framePatch.pro2VisualGroupId = groupId;
  }
  args.updateNodeData(args.frameColumnId, framePatch);

  if (groupId) {
    relayoutPro2MediaGroup(args.setNodes, groupId, { resetOrigin: true });
    if (args.setEdges) {
      ensurePro2HubToMediaGroupChildEdges(
        args.setEdges,
        args.hubNodeId,
        groupId,
        newChildIds,
      );
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
    const img = findPro2FrameImageNodeForRow(nodes, frameColumnId, row.key);
    if (!img) continue;
    const preview = frameRowPreview(row);
    updateNodeData(img.id, {
      label: `镜 ${row.frameIndex}`,
      dockInput: row.prompt ?? "",
      ...preview,
    });
  }
}
