"use client";

import type { StoryProCharacterRow } from "./story-pro-workspace-types";
import { buildPro2ThreeViewNodeData } from "./pro2-spawn-nodes";
import {
  pro2MediaChildSize,
  pro2MediaGridLayout,
  pro2MediaGridCols,
  pro2MediaGroupOrigin,
  relayoutPro2MediaGroup,
} from "./pro2-media-group-layout";
import { ensurePro2HubToMediaGroupEdge } from "./pro2-hub-media-group-edge";
import { pickRuntimeImagePreviewUrl } from "./task-media-url";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { GROUP_COLOR_PRESETS } from "./types";

function characterRowPreview(row: StoryProCharacterRow): {
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
  return `三视图 · 脚本 ${idx >= 0 ? idx + 1 : 1}`;
}

function isCharacterThreeViewChild(n: CanvasFlowNode, controllerId: string): boolean {
  if (
    (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId !==
    controllerId
  ) {
    return false;
  }
  if (n.type === "story-pro2-three-view") return true;
  return (
    n.type === "story-pro2-image" &&
    (n.data as { pro2MediaRole?: string }).pro2MediaRole === "character-three-view"
  );
}

export type EnsurePro2CharacterImageGroupArgs = {
  characterColumnId: string;
  hubNodeId: string;
  rows: StoryProCharacterRow[];
  nodes: CanvasFlowNode[];
  addNode: (
    type: "story-pro2-three-view" | "group",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  addNodeInGroup: (
    type: "story-pro2-three-view",
    groupId: string,
    relativePosition: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  createGroupContaining: (
    childIds: string[],
    opts: { label: string; color: string },
  ) => string | null;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges?: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
};

export function ensurePro2CharacterImageGroup(
  args: EnsurePro2CharacterImageGroupArgs,
): string | null {
  const colNode = args.nodes.find((n) => n.id === args.characterColumnId);
  if (!colNode) return null;

  let existingGroup = args.nodes.find(
    (n) =>
      n.type === "group" &&
      (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
        args.characterColumnId,
  );
  if (!existingGroup) {
    const colData = colNode.data as { pro2VisualGroupId?: string };
    if (colData.pro2VisualGroupId) {
      existingGroup = args.nodes.find((n) => n.id === colData.pro2VisualGroupId);
    }
  }
  if (existingGroup) {
    const gd = existingGroup.data as {
      pro2Kind?: string;
      pro2ControllerNodeId?: string;
      pro2HubNodeId?: string;
    };
    if (
      gd.pro2Kind !== "character-board" ||
      !gd.pro2ControllerNodeId ||
      !gd.pro2HubNodeId
    ) {
      args.updateNodeData(existingGroup.id, {
        pro2Kind: "character-board",
        pro2HubNodeId: args.hubNodeId,
        pro2ControllerNodeId: args.characterColumnId,
        label: groupLabel(args.hubNodeId, args.nodes),
      });
    }
  }

  const sorted = [...args.rows].sort((a, b) => a.name.localeCompare(b.name, "zh"));
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

  const childNodes = args.nodes.filter((n) =>
    isCharacterThreeViewChild(n, args.characterColumnId),
  );

  const newChildIds: string[] = [];
  const cellSize = pro2MediaChildSize({ type: "story-pro2-three-view" });
  const cols = pro2MediaGridCols(sorted.length);

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const preview = characterRowPreview(row);
    const label = row.name?.trim() || `角色 ${i + 1}`;
    const prompt = row.prompt?.trim() || row.appearance?.trim() || "";
    const existing = childNodes.find(
      (n) => (n.data as { pro2RowKey?: string }).pro2RowKey === row.key,
    );

    if (existing) {
      args.updateNodeData(existing.id, {
        label,
        dockInput: prompt,
        ...preview,
        pro2RowKey: row.key,
        pro2HubNodeId: args.hubNodeId,
        pro2ControllerNodeId: args.characterColumnId,
        pro2GroupId: groupId,
      });
      newChildIds.push(existing.id);
      continue;
    }

    const rel = pro2MediaGridLayout(i, cellSize, cols);
    const data = {
      ...buildPro2ThreeViewNodeData({ label }),
      dockInput: prompt,
      ...preview,
      pro2RowKey: row.key,
      pro2HubNodeId: args.hubNodeId,
      pro2ControllerNodeId: args.characterColumnId,
    };

    if (groupId) {
      const id = args.addNodeInGroup("story-pro2-three-view", groupId, rel, data);
      if (id) newChildIds.push(id);
    } else {
      const abs = { x: origin.x + rel.x, y: origin.y + rel.y };
      const id = args.addNode("story-pro2-three-view", abs, data);
      if (id) newChildIds.push(id);
    }
  }

  if (!newChildIds.length) return groupId ?? null;

  if (!groupId) {
    groupId =
      args.createGroupContaining(newChildIds, {
        label: groupLabel(args.hubNodeId, args.nodes),
        color: GROUP_COLOR_PRESETS[2],
      }) ?? undefined;
    if (groupId) {
      for (const cid of newChildIds) {
        args.updateNodeData(cid, { pro2GroupId: groupId });
      }
      args.updateNodeData(groupId, {
        pro2Kind: "character-board",
        pro2HubNodeId: args.hubNodeId,
        pro2ControllerNodeId: args.characterColumnId,
        label: groupLabel(args.hubNodeId, args.nodes),
      });
    }
  }

  args.updateNodeData(args.characterColumnId, {
    pro2VisualGroupId: groupId,
    hubNodeId: args.hubNodeId,
  });

  args.setNodes((prev) =>
    prev.map((n) =>
      n.id === args.characterColumnId
        ? { ...n, selectable: false, focusable: false }
        : n,
    ),
  );

  if (groupId) {
    relayoutPro2MediaGroup(args.setNodes, groupId);
    if (args.setEdges) {
      ensurePro2HubToMediaGroupEdge(args.setEdges, args.hubNodeId, groupId);
    }
  }

  return groupId ?? null;
}

export function syncPro2CharacterImagesFromRows(
  nodes: CanvasFlowNode[],
  characterColumnId: string,
  rows: StoryProCharacterRow[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  for (const row of rows) {
    const img = nodes.find(
      (n) =>
        isCharacterThreeViewChild(n, characterColumnId) &&
        (n.data as { pro2RowKey?: string }).pro2RowKey === row.key,
    );
    if (!img) continue;
    const preview = characterRowPreview(row);
    const prompt = row.prompt?.trim() || row.appearance?.trim() || "";
    updateNodeData(img.id, {
      label: row.name?.trim() || "角色",
      dockInput: prompt,
      ...preview,
    });
  }
}
