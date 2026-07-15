import { nanoid } from "nanoid";
import { fetchProjectAsset, patchProjectAsset } from "@/lib/canvas-api";
import type { CrewBulletinAnchor } from "./crew-bulletin-context";
import { isCrewBulletinGraphMetaAnchor } from "./crew-bulletin-context";
import type { CrewBulletinPatchStore } from "./crew-bulletin-patch";
import type { CrewBulletinTask, CrewTaskKind } from "./crew-bulletin-types";
import { CREW_BULLETIN_KIND_LABELS } from "./crew-bulletin-types";
import { pickRuntimeImagePreviewUrl } from "./task-media-url";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import type { CanvasFlowNode, CanvasGraph, CanvasNodeType } from "./types";
import { flowPositionAtViewportCenter } from "./viewport-placement";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";

/** 剧本包 · 按运行栏种类归档的完成快照 */
export type ScriptPackageSnapshot = {
  id: string;
  taskId: string;
  kind: CrewTaskKind;
  label: string;
  episodeNo?: number;
  frameIndex?: number;
  previewUrl?: string;
  videoUrl?: string;
  nodeType?: string;
  sourceNodeId?: string;
  nodeDataSnapshot?: Record<string, unknown>;
  assigneeDisplayName?: string;
  completedAt: string;
  copiedFromSnapshotId?: string;
  /** 关联 hub 行修订 id（行编辑后完成制作时写入） */
  revisionId?: string;
  /** 被更新版本取代时标记 */
  supersededAt?: string;
};

export type ScriptPackageSnapshotsByKind = Partial<
  Record<CrewTaskKind, ScriptPackageSnapshot[]>
>;

const SNAPSHOT_DATA_KEYS = [
  "ossUrl",
  "blobUrl",
  "imageUrl",
  "videoUrl",
  "outputUrl",
  "dockInput",
  "label",
  "pro2MediaRole",
  "pro2RowKey",
  "pro2HubNodeId",
  "engine",
  "crewTaskKind",
  "modelKey",
  "providerId",
  "params",
  "runtime",
  "pro2ThreeViewSlots",
  "pro2FrameIndex",
  "pro2EpisodeNo",
] as const;

export function flattenScriptPackageSnapshots(
  byKind: ScriptPackageSnapshotsByKind | undefined,
): ScriptPackageSnapshot[] {
  if (!byKind) return [];
  const out: ScriptPackageSnapshot[] = [];
  for (const list of Object.values(byKind)) {
    if (Array.isArray(list)) out.push(...list);
  }
  return out.sort(
    (a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
}

export function countScriptPackageSnapshots(
  byKind: ScriptPackageSnapshotsByKind | undefined,
): number {
  return flattenScriptPackageSnapshots(byKind).length;
}

export function parseScriptPackageSnapshotsFromPayload(
  payload: Record<string, unknown> | undefined,
): ScriptPackageSnapshotsByKind {
  const raw = payload?.scriptPackageSnapshots;
  if (!raw || typeof raw !== "object") return {};
  return raw as ScriptPackageSnapshotsByKind;
}

function sanitizeNodeDataForSnapshot(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of SNAPSHOT_DATA_KEYS) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}

function pickNodeMediaUrls(data: Record<string, unknown>): {
  previewUrl?: string;
  videoUrl?: string;
} {
  const d = data as {
    ossUrl?: string;
    blobUrl?: string;
    imageUrl?: string;
    videoUrl?: string;
    outputUrl?: string;
    runtime?: { ossUrl?: string; ephemeralUrl?: string; status?: string };
    modelKey?: string;
  };
  const video =
    d.videoUrl?.trim() ||
    (d.ossUrl?.includes("/node-video/") ? d.ossUrl.trim() : undefined) ||
    (d.outputUrl?.includes(".mp4") ? d.outputUrl.trim() : undefined);
  const preview =
    pickRuntimeImagePreviewUrl(d.runtime, d.modelKey) ??
    d.imageUrl?.trim() ??
    d.ossUrl?.trim() ??
    d.blobUrl?.trim() ??
    d.outputUrl?.trim();
  return {
    previewUrl: preview || undefined,
    videoUrl: video || undefined,
  };
}

/** 从任务 + 工作节点构建剧本包快照 */
export function buildScriptPackageSnapshot(args: {
  task: CrewBulletinTask;
  node?: CanvasFlowNode;
  assigneeDisplayName?: string;
  completedAt?: string;
}): ScriptPackageSnapshot {
  const { task, node } = args;
  const data = (node?.data ?? {}) as Record<string, unknown>;
  const media = node ? pickNodeMediaUrls(data) : {};
  return {
    id: `snap_${nanoid(10)}`,
    taskId: task.id,
    kind: task.kind,
    label: task.label,
    episodeNo: task.episodeNo,
    frameIndex: task.frameIndex,
    previewUrl: media.previewUrl,
    videoUrl: media.videoUrl,
    nodeType: node?.type,
    sourceNodeId: node?.id,
    nodeDataSnapshot: node ? sanitizeNodeDataForSnapshot(data) : undefined,
    assigneeDisplayName:
      args.assigneeDisplayName ?? task.assigneeDisplayName ?? "我",
    completedAt: args.completedAt ?? new Date().toISOString(),
  };
}

export function resolveLinkedScriptPackageAssetId(
  anchor: CrewBulletinAnchor,
  graphMeta?: CanvasGraph["meta"] | null,
  nodes?: CanvasFlowNode[],
): string | undefined {
  if (isCrewBulletinGraphMetaAnchor(anchor)) {
    return (
      graphMeta?.crewBulletinAnchor?.linkedScriptPackageAssetId ??
      graphMeta?.linkedScriptPackageAssetId
    );
  }
  const node = nodes?.find((n) => n.id === anchor.nodeId);
  const hubData = node?.data as
    | (StoryProScriptHubNodeData & {
        linkedScriptPackageAssetId?: string;
        workspaceIds?: { linkedScriptPackageAssetId?: string };
      })
    | undefined;
  return (
    hubData?.linkedScriptPackageAssetId ??
    hubData?.workspaceIds?.linkedScriptPackageAssetId ??
    graphMeta?.linkedScriptPackageAssetId ??
    graphMeta?.crewBulletinAnchor?.linkedScriptPackageAssetId
  );
}

export function resolveScriptPackageSnapshots(
  anchor: CrewBulletinAnchor,
  graphMeta?: CanvasGraph["meta"] | null,
  nodes?: CanvasFlowNode[],
): ScriptPackageSnapshotsByKind {
  if (isCrewBulletinGraphMetaAnchor(anchor)) {
    return graphMeta?.crewBulletinAnchor?.scriptPackageSnapshots ?? {};
  }
  const node = nodes?.find((n) => n.id === anchor.nodeId);
  const data = node?.data as
    | { scriptPackageSnapshots?: ScriptPackageSnapshotsByKind }
    | undefined;
  return data?.scriptPackageSnapshots ?? {};
}

function appendToByKind(
  current: ScriptPackageSnapshotsByKind,
  snapshot: ScriptPackageSnapshot,
): ScriptPackageSnapshotsByKind {
  const prevList = current[snapshot.kind] ?? [];
  const superseded = prevList.map((s) =>
    s.taskId === snapshot.taskId && !s.supersededAt
      ? { ...s, supersededAt: snapshot.completedAt }
      : s,
  );
  const list = [...superseded, snapshot];
  return { ...current, [snapshot.kind]: list };
}

function removeTaskSnapshots(
  current: ScriptPackageSnapshotsByKind,
  taskId: string,
): ScriptPackageSnapshotsByKind {
  const next: ScriptPackageSnapshotsByKind = {};
  for (const [kind, list] of Object.entries(current)) {
    const filtered = (list ?? []).filter((s) => s.taskId !== taskId);
    if (filtered.length) {
      next[kind as CrewTaskKind] = filtered;
    }
  }
  return next;
}

export function patchScriptPackageSnapshotsOnAnchor(
  anchor: CrewBulletinAnchor,
  snapshots: ScriptPackageSnapshotsByKind,
  store: CrewBulletinPatchStore,
): void {
  if (isCrewBulletinGraphMetaAnchor(anchor)) {
    store.patchGraphMeta?.((meta) => {
      if (!meta?.crewBulletinAnchor) return meta ?? undefined;
      return {
        ...meta,
        crewBulletinAnchor: {
          ...meta.crewBulletinAnchor,
          scriptPackageSnapshots: snapshots,
        },
      };
    });
    return;
  }
  store.updateNodeData(anchor.nodeId, { scriptPackageSnapshots: snapshots });
}

export function appendScriptPackageSnapshot(
  anchor: CrewBulletinAnchor,
  snapshot: ScriptPackageSnapshot,
  store: CrewBulletinPatchStore,
  graphMeta?: CanvasGraph["meta"] | null,
  nodes?: CanvasFlowNode[],
): ScriptPackageSnapshotsByKind {
  const current = resolveScriptPackageSnapshots(anchor, graphMeta, nodes);
  const next = appendToByKind(current, snapshot);
  patchScriptPackageSnapshotsOnAnchor(anchor, next, store);
  return next;
}

/** 某 taskId 的活跃（未取代）快照，按完成时间倒序 */
export function listActiveSnapshotsForTask(
  byKind: ScriptPackageSnapshotsByKind | undefined,
  taskId: string,
): ScriptPackageSnapshot[] {
  return flattenScriptPackageSnapshots(byKind).filter(
    (s) => s.taskId === taskId && !s.supersededAt,
  );
}

export function removeScriptPackageSnapshotForTask(
  anchor: CrewBulletinAnchor,
  taskId: string,
  store: CrewBulletinPatchStore,
  graphMeta?: CanvasGraph["meta"] | null,
  nodes?: CanvasFlowNode[],
): ScriptPackageSnapshotsByKind {
  const current = resolveScriptPackageSnapshots(anchor, graphMeta, nodes);
  const next = removeTaskSnapshots(current, taskId);
  patchScriptPackageSnapshotsOnAnchor(anchor, next, store);
  return next;
}

export async function persistScriptPackageSnapshotsToAsset(
  base: string,
  assetId: string,
  snapshots: ScriptPackageSnapshotsByKind,
): Promise<void> {
  if (!base.trim() || !assetId.trim()) return;
  try {
    const asset = await fetchProjectAsset(base, assetId);
    await patchProjectAsset(base, assetId, {
      payload: {
        ...asset.payload,
        scriptPackageSnapshots: snapshots,
      },
    });
  } catch {
    /* 资产同步失败不阻断完成制作 */
  }
}

export function scriptPackageSnapshotKindLabel(kind: CrewTaskKind): string {
  return CREW_BULLETIN_KIND_LABELS[kind] ?? kind;
}

export type ScriptPackageSnapshotSpawnStore = {
  nodes: CanvasFlowNode[];
  duplicateNode: (
    id: string,
    options?: { preserveContent?: boolean },
  ) => string | null;
  addNode: (
    type: string,
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
};

/** 复制快照到画布（优先 duplicate 源节点，否则从 data 快照 spawn） */
export function spawnScriptPackageSnapshotOnCanvas(
  snapshot: ScriptPackageSnapshot,
  store: ScriptPackageSnapshotSpawnStore,
  opts?: { hubNodeId?: string },
): string | null {
  if (snapshot.sourceNodeId) {
    const exists = store.nodes.some((n) => n.id === snapshot.sourceNodeId);
    if (exists) {
      const newId = store.duplicateNode(snapshot.sourceNodeId, {
        preserveContent: true,
      });
      if (newId) return newId;
    }
  }

  const nodeType = snapshot.nodeType as CanvasNodeType | undefined;
  if (!nodeType || !snapshot.nodeDataSnapshot) return null;

  const position = flowPositionAtViewportCenter(nodeType);
  const data: Record<string, unknown> = {
    ...snapshot.nodeDataSnapshot,
    crewTaskKind: snapshot.kind,
    crewTaskFork: true,
    crewTaskForkedFromSnapshotId: snapshot.id,
    pro2HubNodeId: opts?.hubNodeId ?? snapshot.nodeDataSnapshot.pro2HubNodeId,
  };
  delete data.crewTaskId;
  delete data.crewTaskLastSubmittedAt;

  const newId = store.addNode(nodeType, position, data);
  if (newId) selectPro2NodeAfterSpawn(store.setNodes, newId);
  return newId;
}
