import type { StoryScriptHubNodeData } from "./story-workspace-types";
import {
  isAnyStoryCharacterColumnType,
  isAnyStoryFrameColumnType,
  isAnyStorySceneColumnType,
  isAnyStoryScriptHubType,
  isAnyStoryVideoColumnType,
} from "./story-workspace-resolver";
import type {
  CanvasFlowNode,
  CanvasNodeRuntime,
  CanvasNodeRunStatus,
} from "./types";
import { isLibtvFreestandingImageNode } from "./libtv-image-node-run";

type RowRuntimeSlice = {
  status?: CanvasNodeRunStatus;
  failMessage?: string;
};

type StoryMediaRow = {
  runtime?: RowRuntimeSlice;
  videoRuntime?: RowRuntimeSlice;
  ttsRuntime?: RowRuntimeSlice;
};

function collectStatuses(row: StoryMediaRow): CanvasNodeRunStatus[] {
  const out: CanvasNodeRunStatus[] = [];
  if (row.runtime?.status) out.push(row.runtime.status);
  if (row.videoRuntime?.status) out.push(row.videoRuntime.status);
  if (row.ttsRuntime?.status) out.push(row.ttsRuntime.status);
  return out;
}

function firstFailMessageForErrorRows(row: StoryMediaRow): string | undefined {
  const slices = [row.runtime, row.videoRuntime, row.ttsRuntime];
  for (const slice of slices) {
    if (slice?.status === "error" && slice.failMessage?.trim()) {
      return slice.failMessage;
    }
  }
  return undefined;
}

/** 聚合列内各行 runtime，供 NodeShell 标题栏状态徽标（与画布顶栏任务态一致） */
export function aggregateStoryColumnRuntime(
  rows: StoryMediaRow[],
): CanvasNodeRuntime {
  const statuses = rows.flatMap(collectStatuses);

  if (statuses.some((s) => s === "running")) {
    return { status: "running" };
  }
  if (statuses.some((s) => s === "pending")) {
    return { status: "pending" };
  }
  if (statuses.some((s) => s === "error")) {
    const failMessage = rows.map(firstFailMessageForErrorRows).find(Boolean);
    return { status: "error", failMessage };
  }
  if (statuses.length > 0 && statuses.every((s) => s === "done")) {
    return { status: "done" };
  }
  return { status: "idle" };
}

export function storyColumnIsGenerating(runtime: CanvasNodeRuntime): boolean {
  return runtime.status === "running" || runtime.status === "pending";
}

export function isCanvasInflightStatus(status?: string): boolean {
  return status === "pending" || status === "running";
}

function hubSectionInflightCount(d: StoryScriptHubNodeData): number {
  let count = 0;
  if (isCanvasInflightStatus(d.outlineRuntime?.status)) count += 1;
  if (isCanvasInflightStatus(d.characterRuntime?.status)) count += 1;
  if (isCanvasInflightStatus(d.sceneRuntime?.status)) count += 1;
  if (isCanvasInflightStatus(d.storyboardRuntime?.status)) count += 1;
  return count;
}

function hubHasInflightWork(d: StoryScriptHubNodeData): boolean {
  return hubSectionInflightCount(d) > 0;
}

/** 单节点是否仍有进行中的生成（含漫剧列行级 / 文案段 runtime） */
function storyImageColumnInflightCount(node: CanvasFlowNode): number {
  const rows = (node.data as { rows?: StoryMediaRow[] }).rows ?? [];
  return rows.filter((r) => isCanvasInflightStatus(r.runtime?.status)).length;
}

export function canvasNodeHasInflightWork(node: CanvasFlowNode): boolean {
  if (
    isAnyStoryCharacterColumnType(node.type ?? "") ||
    isAnyStorySceneColumnType(node.type ?? "") ||
    isAnyStoryFrameColumnType(node.type ?? "")
  ) {
    return storyImageColumnInflightCount(node) > 0;
  }
  if (isAnyStoryVideoColumnType(node.type ?? "")) {
    const rows = (node.data as { rows?: StoryMediaRow[] }).rows ?? [];
    return rows.some(
      (r) =>
        isCanvasInflightStatus(r.videoRuntime?.status) ||
        isCanvasInflightStatus(r.ttsRuntime?.status),
    );
  }
  if (isAnyStoryScriptHubType(node.type ?? "")) {
    const d = node.data as unknown as StoryScriptHubNodeData;
    return hubHasInflightWork(d);
  }
  if (node.type === "story-pro-starter" || node.type === "story-pro2-starter") {
    const rt = (
      node.data as { themeOutlineRuntime?: { status?: string } }
    ).themeOutlineRuntime?.status;
    if (isCanvasInflightStatus(rt)) return true;
  }
  if (
    isLibtvFreestandingImageNode(node) ||
    node.type === "sbv1-video-engine"
  ) {
    const d = node.data as { uploading?: boolean; runtime?: { status?: string } };
    if (d.uploading) return true;
  }
  const top = (node.data as { runtime?: { status?: string } }).runtime?.status;
  return isCanvasInflightStatus(top);
}

/** 仍有进行中生成的节点 id（供任务轮询使用） */
export function collectCanvasInflightNodeIds(nodes: CanvasFlowNode[]): string[] {
  return nodes.filter(canvasNodeHasInflightWork).map((n) => n.id);
}

/** 本地 error 但服务端可能已有新 SUBMITTED 任务（重试后前台未同步） */
function storyVideoColumnHasStaleError(node: CanvasFlowNode): boolean {
  if (!isAnyStoryVideoColumnType(node.type ?? "")) return false;
  const rows = (node.data as { rows?: StoryMediaRow[] }).rows ?? [];
  return rows.some(
    (r) =>
      r.videoRuntime?.status === "error" || r.ttsRuntime?.status === "error",
  );
}

/**
 * 任务轮询节点 id：进行中 + 视频列本地失败（便于拉回服务端 SUBMITTED 状态）。
 * 返回空数组时 run-queue 会走全量扫描。
 */
export function collectCanvasTaskPollNodeIds(
  nodes: CanvasFlowNode[],
): string[] {
  const ids = new Set(collectCanvasInflightNodeIds(nodes));
  for (const node of nodes) {
    if (storyVideoColumnHasStaleError(node)) ids.add(node.id);
  }
  return [...ids];
}

/** 画布顶栏：进行中的生成任务数（含漫剧列行级 runtime） */
export function countCanvasInflightWork(nodes: CanvasFlowNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (
      isAnyStoryCharacterColumnType(node.type ?? "") ||
      isAnyStorySceneColumnType(node.type ?? "") ||
      isAnyStoryFrameColumnType(node.type ?? "")
    ) {
      count += storyImageColumnInflightCount(node);
      continue;
    }
    if (isAnyStoryVideoColumnType(node.type ?? "")) {
      const rows =
        (node.data as { rows?: StoryMediaRow[] }).rows ?? [];
      for (const r of rows) {
        if (isCanvasInflightStatus(r.videoRuntime?.status)) count += 1;
        if (isCanvasInflightStatus(r.ttsRuntime?.status)) count += 1;
      }
      continue;
    }
    if (isAnyStoryScriptHubType(node.type ?? "")) {
      const d = node.data as unknown as StoryScriptHubNodeData;
      count += hubSectionInflightCount(d);
      continue;
    }
    if (node.type === "story-pro-starter" || node.type === "story-pro2-starter") {
      const rt = (
        node.data as { themeOutlineRuntime?: { status?: string } }
      ).themeOutlineRuntime?.status;
      if (isCanvasInflightStatus(rt)) count += 1;
      continue;
    }
    const top = (node.data as { runtime?: { status?: string } }).runtime?.status;
    if (isCanvasInflightStatus(top)) count += 1;
  }
  return count;
}
