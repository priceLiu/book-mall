"use client";

import { nanoid } from "nanoid";
import type { StoryProSceneRow } from "./story-pro-workspace-types";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import { buildPro2ImageNodeData } from "./pro2-spawn-nodes";
import { sceneRowKeysEquivalent } from "./story-pro-scene-asset-catalog";
import {
  pro2MediaChildSize,
  pro2MediaGridLayout,
  pro2MediaGridCols,
  pro2MediaGroupOrigin,
  relayoutPro2MediaGroup,
} from "./pro2-media-group-layout";
import { ensurePro2HubToMediaGroupEdge } from "./pro2-hub-media-group-edge";
import { pickRuntimeImagePreviewUrl } from "./task-media-url";
import { busEnqueueStoryRunsSequential } from "./canvas-run-bus";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeRuntime } from "./types";
import { GROUP_COLOR_PRESETS } from "./types";

function sceneRowPreview(row: StoryProSceneRow): {
  ossUrl?: string;
  uploading?: boolean;
  uploadError?: string;
  runtime?: CanvasNodeRuntime;
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
    runtime: rt
      ? {
          status: rt.status,
          taskId: rt.taskId,
          ossUrl: rt.ossUrl,
          ephemeralUrl: rt.ephemeralUrl,
          failCode: rt.failCode,
          failMessage: rt.failMessage,
        }
      : undefined,
  };
}

/** 同步到组内图片节点：避免 undefined 覆盖已有 ossUrl */
export function buildSceneImageNodeDataPatch(
  row: StoryProSceneRow,
): Record<string, unknown> {
  const preview = sceneRowPreview(row);
  const patch: Record<string, unknown> = {
    label: row.name?.trim() || "场景",
    dockInput: row.prompt?.trim() || row.description?.trim() || "",
    pro2MediaRole: "scene",
    pro2RowKey: row.key,
    uploading: Boolean(preview.uploading),
  };
  if (preview.ossUrl) {
    patch.ossUrl = preview.ossUrl;
    patch.blobUrl = undefined;
  }
  if (preview.uploadError?.trim()) {
    patch.uploadError = preview.uploadError;
  } else if (!preview.uploading) {
    patch.uploadError = undefined;
  }
  if (preview.runtime) {
    patch.runtime = preview.runtime;
  } else if (!preview.uploading) {
    patch.runtime = undefined;
  }
  return patch;
}

function sceneImageRowKeyMatches(
  nodeKey: string | undefined,
  rowKey: string,
  rowName: string,
): boolean {
  const nk = nodeKey?.trim() ?? "";
  if (!nk) return false;
  if (sceneRowKeysEquivalent(nk, rowKey)) return true;
  const name = rowName.trim();
  return Boolean(name && (nk === name || nk.endsWith(`::${name}`)));
}

/** 场景图组以脚本 hub 为锚点（不再 spawn 场景设计列） */
export function pro2SceneImageControllerId(hubNodeId: string): string {
  return hubNodeId;
}

export function readPro2SceneRowsForHub(
  hubNodeId: string,
  nodes: CanvasFlowNode[],
  legacySceneColumnId?: string,
): StoryProSceneRow[] {
  const hub = nodes.find((n) => n.id === hubNodeId);
  const fromHub = (hub?.data as { sceneRows?: StoryProSceneRow[] }).sceneRows;
  if (fromHub?.length) return fromHub;
  if (legacySceneColumnId) {
    const col = nodes.find((n) => n.id === legacySceneColumnId);
    const rows = (col?.data as { rows?: StoryProSceneRow[] })?.rows;
    if (rows?.length) return rows;
  }
  return [];
}

export function findSceneImageNodeForRow(
  nodes: CanvasFlowNode[],
  controllerId: string,
  row: StoryProSceneRow,
  usedIds: Set<string>,
): CanvasFlowNode | undefined {
  const candidates = nodes.filter(
    (n) => isSceneImageChild(n, controllerId) && !usedIds.has(n.id),
  );
  const byKey = candidates.find((n) =>
    sceneImageRowKeyMatches(
      (n.data as { pro2RowKey?: string }).pro2RowKey,
      row.key,
      row.name,
    ),
  );
  if (byKey) return byKey;
  const name = row.name.trim();
  if (!name) return undefined;
  return candidates.find(
    (n) => (n.data as { label?: string }).label?.trim() === name,
  );
}

function groupLabel(hubNodeId: string, nodes: CanvasFlowNode[]): string {
  const hubs = nodes.filter((n) => n.type === "story-pro2-script-hub");
  const idx = hubs.findIndex((h) => h.id === hubNodeId);
  return `场景图 · 脚本 ${idx >= 0 ? idx + 1 : 1}`;
}

function isSceneImageChild(n: CanvasFlowNode, controllerId: string): boolean {
  const d = n.data as {
    pro2ControllerNodeId?: string;
    pro2HubNodeId?: string;
    pro2MediaRole?: string;
  };
  if (n.type !== "story-pro2-image" || d.pro2MediaRole !== "scene") {
    return false;
  }
  if (d.pro2ControllerNodeId === controllerId) return true;
  if (d.pro2HubNodeId === controllerId && !d.pro2ControllerNodeId) return true;
  return false;
}

function findSceneBoardGroup(
  nodes: CanvasFlowNode[],
  hubNodeId: string,
  legacySceneColumnId?: string,
): CanvasFlowNode | undefined {
  const byHub = nodes.find(
    (n) =>
      n.type === "group" &&
      (n.data as { pro2Kind?: string; pro2HubNodeId?: string }).pro2Kind ===
        "scene-board" &&
      (n.data as { pro2HubNodeId?: string }).pro2HubNodeId === hubNodeId,
  );
  if (byHub) return byHub;
  if (legacySceneColumnId) {
    return nodes.find(
      (n) =>
        n.type === "group" &&
        (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
          legacySceneColumnId,
    );
  }
  return undefined;
}

/** 移除 LibTV 场景图流程中多余的「场景设计」薄节点 */
export function retireLegacyPro2SceneColumn(args: {
  hubNodeId: string;
  starterNodeId: string;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}): void {
  const starter = args.nodes.find((n) => n.id === args.starterNodeId);
  const ws = (starter?.data as { workspaceIds?: StoryPro2WorkspaceIds })
    .workspaceIds;
  const sceneColId = ws?.sceneColumnId;
  if (!sceneColId) return;
  const sceneCol = args.nodes.find(
    (n) => n.id === sceneColId && n.type === "story-pro2-scene",
  );
  if (!sceneCol) return;

  const incoming = args.edges.filter((e) => e.target === sceneColId);
  const outgoing = args.edges.filter((e) => e.source === sceneColId);
  args.setEdges((prev) => {
    let next = prev.filter(
      (e) => e.source !== sceneColId && e.target !== sceneColId,
    );
    for (const out of outgoing) {
      for (const inn of incoming) {
        if (
          next.some(
            (e) => e.source === inn.source && e.target === out.target,
          )
        ) {
          continue;
        }
        next = [
          ...next,
          {
            id: `e-${nanoid(6)}`,
            source: inn.source,
            target: out.target,
            sourceHandle: out.sourceHandle ?? inn.sourceHandle,
            targetHandle: out.targetHandle ?? inn.targetHandle,
          },
        ];
      }
    }
    if (
      !next.some(
        (e) => e.source === args.hubNodeId || e.target === args.hubNodeId,
      ) &&
      incoming.length === 0 &&
      outgoing.length > 0
    ) {
      for (const out of outgoing) {
        if (
          !next.some(
            (e) => e.source === args.hubNodeId && e.target === out.target,
          )
        ) {
          next = [
            ...next,
            {
              id: `e-${nanoid(6)}`,
              source: args.hubNodeId,
              target: out.target,
              sourceHandle: "text",
              targetHandle: out.targetHandle ?? "in_text",
            },
          ];
        }
      }
    }
    return next;
  });

  args.setNodes((prev) => prev.filter((n) => n.id !== sceneColId));
  args.updateNodeData(args.starterNodeId, {
    workspaceIds: { ...ws, sceneColumnId: undefined },
  });
}

export type EnsurePro2SceneImageGroupArgs = {
  hubNodeId: string;
  rows: StoryProSceneRow[];
  nodes: CanvasFlowNode[];
  starterNodeId?: string;
  legacySceneColumnId?: string;
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
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges?: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  edges?: CanvasFlowEdge[];
};

export function ensurePro2SceneImageGroup(
  args: EnsurePro2SceneImageGroupArgs,
): string | null {
  const controllerId = pro2SceneImageControllerId(args.hubNodeId);
  args.updateNodeData(args.hubNodeId, { sceneRows: args.rows });

  let existingGroup = findSceneBoardGroup(
    args.nodes,
    args.hubNodeId,
    args.legacySceneColumnId,
  );

  if (existingGroup) {
    const gd = existingGroup.data as {
      pro2Kind?: string;
      pro2ControllerNodeId?: string;
      pro2HubNodeId?: string;
    };
    if (
      gd.pro2Kind !== "scene-board" ||
      gd.pro2ControllerNodeId !== controllerId ||
      gd.pro2HubNodeId !== args.hubNodeId
    ) {
      args.updateNodeData(existingGroup.id, {
        pro2Kind: "scene-board",
        pro2HubNodeId: args.hubNodeId,
        pro2ControllerNodeId: controllerId,
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
    if (args.starterNodeId && args.setEdges) {
      retireLegacyPro2SceneColumn({
        hubNodeId: args.hubNodeId,
        starterNodeId: args.starterNodeId,
        nodes: args.nodes,
        edges: args.edges ?? [],
        setNodes: args.setNodes,
        setEdges: args.setEdges,
        updateNodeData: args.updateNodeData,
      });
    }
    return existingGroup?.id ?? null;
  }

  const origin = pro2MediaGroupOrigin(args.nodes, args.hubNodeId);
  let groupId = existingGroup?.id;

  const childNodes = args.nodes.filter((n) => {
    if (!isSceneImageChild(n, controllerId)) return false;
    if (
      args.legacySceneColumnId &&
      (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
        args.legacySceneColumnId
    ) {
      return true;
    }
    return (
      (n.data as { pro2HubNodeId?: string }).pro2HubNodeId === args.hubNodeId
    );
  });

  const newChildIds: string[] = [];
  const usedChildIds = new Set<string>();
  const cellSize = pro2MediaChildSize({ pro2MediaRole: "scene" });
  const cols = pro2MediaGridCols(sorted.length);

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const label = row.name?.trim() || `场景 ${i + 1}`;
    const existing = findSceneImageNodeForRow(
      childNodes,
      controllerId,
      row,
      usedChildIds,
    );

    if (existing) {
      usedChildIds.add(existing.id);
      args.updateNodeData(existing.id, {
        ...buildSceneImageNodeDataPatch(row),
        pro2HubNodeId: args.hubNodeId,
        pro2ControllerNodeId: controllerId,
        pro2GroupId: groupId,
      });
      newChildIds.push(existing.id);
      continue;
    }

    const rel = pro2MediaGridLayout(i, cellSize, cols);
    const data = {
      ...buildPro2ImageNodeData({ label }),
      ...buildSceneImageNodeDataPatch(row),
      pro2HubNodeId: args.hubNodeId,
      pro2ControllerNodeId: controllerId,
    };

    if (groupId) {
      const id = args.addNodeInGroup("story-pro2-image", groupId, rel, data);
      if (id) newChildIds.push(id);
    } else {
      const abs = { x: origin.x + rel.x, y: origin.y + rel.y };
      const id = args.addNode("story-pro2-image", abs, data);
      if (id) newChildIds.push(id);
    }
  }

  if (!newChildIds.length) return groupId ?? null;

  if (!groupId) {
    groupId =
      args.createGroupContaining(newChildIds, {
        label: groupLabel(args.hubNodeId, args.nodes),
        color: GROUP_COLOR_PRESETS[3],
      }) ?? undefined;
    if (groupId) {
      for (const cid of newChildIds) {
        args.updateNodeData(cid, { pro2GroupId: groupId });
      }
      args.updateNodeData(groupId, {
        pro2Kind: "scene-board",
        pro2HubNodeId: args.hubNodeId,
        pro2ControllerNodeId: controllerId,
        label: groupLabel(args.hubNodeId, args.nodes),
      });
    }
  }

  args.setNodes((prev) =>
    prev.map((n) => {
      if (
        n.type === "story-pro2-image" &&
        (n.data as { pro2HubNodeId?: string }).pro2HubNodeId === args.hubNodeId &&
        (n.data as { pro2MediaRole?: string }).pro2MediaRole === "scene" &&
        (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId !==
          controllerId
      ) {
        return {
          ...n,
          data: { ...n.data, pro2ControllerNodeId: controllerId },
        };
      }
      return n;
    }),
  );

  if (groupId) {
    relayoutPro2MediaGroup(args.setNodes, groupId, { resetOrigin: true });
    if (args.setEdges) {
      ensurePro2HubToMediaGroupEdge(args.setEdges, args.hubNodeId, groupId);
    }
  }

  if (args.starterNodeId && args.setEdges) {
    retireLegacyPro2SceneColumn({
      hubNodeId: args.hubNodeId,
      starterNodeId: args.starterNodeId,
      nodes: args.nodes,
      edges: args.edges ?? [],
      setNodes: args.setNodes,
      setEdges: args.setEdges,
      updateNodeData: args.updateNodeData,
    });
  }

  return groupId ?? null;
}

export function syncPro2SceneImagesFromRows(
  nodes: CanvasFlowNode[],
  controllerId: string,
  rows: StoryProSceneRow[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const usedIds = new Set<string>();
  for (const row of rows) {
    const img = findSceneImageNodeForRow(nodes, controllerId, row, usedIds);
    if (!img) continue;
    usedIds.add(img.id);
    const d = img.data as {
      uploading?: boolean;
      runtime?: { status?: string };
    };
    const nodeInflight =
      d.uploading ||
      d.runtime?.status === "pending" ||
      d.runtime?.status === "running";
    if (nodeInflight) {
      updateNodeData(img.id, {
        label: row.name?.trim() || "场景",
        dockInput: row.prompt?.trim() || row.description?.trim() || "",
        pro2RowKey: row.key,
      });
      continue;
    }
    updateNodeData(img.id, buildSceneImageNodeDataPatch(row));
  }
}

/** 场景图组 · 按行触发组内图片节点（不再依赖场景设计列 batch） */
export function batchRunPro2SceneImageNodes(
  nodes: CanvasFlowNode[],
  hubNodeId: string,
  rows: StoryProSceneRow[],
  rowKeys: string[],
  options?: { forceFresh?: boolean },
): void {
  const allowed = new Set(rowKeys.filter(Boolean));
  if (!allowed.size) return;
  const usedIds = new Set<string>();
  const nodeIds: string[] = [];
  for (const row of rows) {
    if (!allowed.has(row.key)) continue;
    const img = findSceneImageNodeForRow(
      nodes,
      pro2SceneImageControllerId(hubNodeId),
      row,
      usedIds,
    );
    if (!img) continue;
    usedIds.add(img.id);
    nodeIds.push(img.id);
  }
  if (!nodeIds.length) return;
  busEnqueueStoryRunsSequential(
    nodeIds.map((nodeId) => ({
      nodeId,
      forceFresh: options?.forceFresh,
    })),
    options,
  );
}

/** hydrate / 打开画布：去掉多余「场景设计」列，场景行挂到脚本 hub */
export function migratePro2SceneColumnOffCanvas(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] } {
  const sceneCols = nodes.filter((n) => n.type === "story-pro2-scene");
  if (!sceneCols.length) return { nodes, edges };

  let nextNodes = nodes.map((n) => ({ ...n, data: { ...n.data } }));
  let nextEdges = [...edges];

  for (const sceneCol of sceneCols) {
    const hubId = (sceneCol.data as { hubNodeId?: string }).hubNodeId;
    if (!hubId) continue;
    const hubIdx = nextNodes.findIndex((n) => n.id === hubId);
    if (hubIdx < 0) continue;

    const rows = (sceneCol.data as { rows?: StoryProSceneRow[] }).rows ?? [];
    const hub = nextNodes[hubIdx]!;
    const hubData = hub.data as Record<string, unknown>;
    if (rows.length && !Array.isArray(hubData.sceneRows)) {
      hubData.sceneRows = rows;
    }
    const batch = (sceneCol.data as { batchImage?: unknown }).batchImage;
    if (batch && !hubData.sceneBatchImage) {
      hubData.sceneBatchImage = batch;
    }

    const controllerId = pro2SceneImageControllerId(hubId);
    nextNodes = nextNodes.map((n) => {
      if (n.id === sceneCol.id) return n;
      const d = n.data as { pro2ControllerNodeId?: string };
      if (d.pro2ControllerNodeId !== sceneCol.id) return n;
      return {
        ...n,
        data: { ...n.data, pro2ControllerNodeId: controllerId },
      };
    });

    const incoming = nextEdges.filter((e) => e.target === sceneCol.id);
    const outgoing = nextEdges.filter((e) => e.source === sceneCol.id);
    nextEdges = nextEdges.filter(
      (e) => e.source !== sceneCol.id && e.target !== sceneCol.id,
    );
    for (const out of outgoing) {
      for (const inn of incoming) {
        if (
          nextEdges.some(
            (e) => e.source === inn.source && e.target === out.target,
          )
        ) {
          continue;
        }
        nextEdges.push({
          id: `e-${nanoid(6)}`,
          source: inn.source,
          target: out.target,
          sourceHandle: out.sourceHandle ?? inn.sourceHandle,
          targetHandle: out.targetHandle ?? inn.targetHandle,
        });
      }
    }

    nextNodes = nextNodes.filter((n) => n.id !== sceneCol.id);

    nextNodes = nextNodes.map((n) => {
      if (n.type !== "story-pro2-starter") return n;
      const ws = (n.data as { workspaceIds?: StoryPro2WorkspaceIds })
        .workspaceIds;
      if (ws?.sceneColumnId !== sceneCol.id) return n;
      return {
        ...n,
        data: {
          ...n.data,
          workspaceIds: { ...ws, sceneColumnId: undefined },
        },
      };
    });
  }

  return { nodes: nextNodes, edges: nextEdges };
}
