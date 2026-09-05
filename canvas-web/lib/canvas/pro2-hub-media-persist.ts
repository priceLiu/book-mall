/**
 * Pro2 剧本 Hub · 分镜图/视频生成完成后增量回写 Hub 行表并标记修订时间
 */
import { requestCanvasGraphPersistFlush } from "./canvas-persist-request";
import type {
  StoryProFrameRow,
  StoryProScriptHubNodeData,
  StoryProVideoRow,
} from "./story-pro-workspace-types";
import type { CanvasFlowNode } from "./types";

function frameRowMediaFingerprint(row: StoryProFrameRow): string {
  const rt = row.runtime;
  return [
    row.key,
    rt?.status ?? "",
    rt?.ossUrl ?? "",
    rt?.ephemeralUrl ?? "",
    rt?.taskId ?? "",
    row.frameApprovedAt ?? "",
  ].join("|");
}

function videoRowMediaFingerprint(row: StoryProVideoRow): string {
  return [
    row.key,
    row.videoRuntime?.status ?? "",
    row.videoRuntime?.ossUrl ?? "",
    row.videoRuntime?.ephemeralUrl ?? "",
    row.ttsRuntime?.status ?? "",
    row.ttsRuntime?.ossUrl ?? "",
    row.frameImageUrl ?? "",
  ].join("|");
}

function rowsMediaChanged<T>(
  prev: T[],
  next: T[],
  fingerprint: (row: T) => string,
): boolean {
  if (prev.length !== next.length) return true;
  const prevFp = new Map(prev.map((r, i) => [(r as { key?: string }).key ?? String(i), fingerprint(r)]));
  for (const row of next) {
    const key = (row as { key?: string }).key ?? "";
    if (prevFp.get(key) !== fingerprint(row)) return true;
  }
  return false;
}

/** 分镜列/视频列媒体态变更 → 合并回 Hub.scriptStudioFrameRows（增量持久化锚点） */
export function buildPro2HubMediaIncrementalPatch(
  hubData: StoryProScriptHubNodeData,
  frameRows: StoryProFrameRow[],
  videoRows?: StoryProVideoRow[],
): Partial<StoryProScriptHubNodeData> | null {
  const prevFrames = hubData.scriptStudioFrameRows ?? [];
  const frameChanged =
    frameRows.length > 0 &&
    rowsMediaChanged(prevFrames, frameRows, frameRowMediaFingerprint);
  const prevVideos = hubData.scriptStudioVideoRows ?? [];
  const videoChanged =
    Boolean(videoRows?.length) &&
    rowsMediaChanged(prevVideos, videoRows!, videoRowMediaFingerprint);

  if (!frameChanged && !videoChanged) return null;

  return {
    ...(frameChanged ? { scriptStudioFrameRows: frameRows } : {}),
    ...(videoChanged ? { scriptStudioVideoRows: videoRows } : {}),
    productionScriptMediaRevisionAt: new Date().toISOString(),
  };
}

/** 分镜图/视频列任务完成 · 增量写回 Hub 并立即 autosave */
export function tryPersistPro2HubMediaFromColumns(
  allNodes: CanvasFlowNode[],
  hubId: string,
  frameRows: StoryProFrameRow[],
  videoRows: StoryProVideoRow[] | undefined,
  updateNodeData: (id: string, patch: Partial<StoryProScriptHubNodeData>) => void,
): void {
  const hub = allNodes.find((n) => n.id === hubId);
  if (!hub) return;
  const patch = buildPro2HubMediaIncrementalPatch(
    hub.data as StoryProScriptHubNodeData,
    frameRows,
    videoRows,
  );
  if (!patch) return;
  updateNodeData(hubId, patch);
  requestCanvasGraphPersistFlush({ immediate: true });
}
