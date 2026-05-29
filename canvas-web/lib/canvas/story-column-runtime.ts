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

function firstFailMessage(row: StoryMediaRow): string | undefined {
  return (
    row.runtime?.failMessage ??
    row.videoRuntime?.failMessage ??
    row.ttsRuntime?.failMessage
  );
}

/** 聚合列内各行 runtime，供 NodeShell 标题栏状态徽标（与画布顶栏任务态一致） */
export function aggregateStoryColumnRuntime(
  rows: StoryMediaRow[],
): CanvasNodeRuntime {
  const statuses = rows.flatMap(collectStatuses);
  const failMessage = rows.map(firstFailMessage).find(Boolean);

  if (statuses.some((s) => s === "running")) {
    return { status: "running", failMessage };
  }
  if (statuses.some((s) => s === "pending")) {
    return { status: "pending", failMessage };
  }
  if (statuses.some((s) => s === "error")) {
    return { status: "error", failMessage };
  }
  if (statuses.length > 0 && statuses.every((s) => s === "done")) {
    return { status: "done", failMessage };
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
  const top = (node.data as { runtime?: { status?: string } }).runtime?.status;
  return isCanvasInflightStatus(top);
}

/** 仍有进行中生成的节点 id（供任务轮询使用） */
export function collectCanvasInflightNodeIds(nodes: CanvasFlowNode[]): string[] {
  return nodes.filter(canvasNodeHasInflightWork).map((n) => n.id);
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
    const top = (node.data as { runtime?: { status?: string } }).runtime?.status;
    if (isCanvasInflightStatus(top)) count += 1;
  }
  return count;
}
