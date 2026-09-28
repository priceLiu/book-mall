/**
 * 向导 Step3 · 分镜图/视频完成 · 挂 preview 到 Hub rows
 */
import { syncStoryProColumnRows } from "@/lib/canvas/story-pro-column-sync";
import {
  parseWizardShotDraftKey,
  shotRowKey,
  type Pro2WizardShotMediaKind,
} from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import {
  applyFrameRowRuntime,
  applyVideoRowRuntime,
} from "@/lib/canvas/story-row-patch";
import type {
  StoryProFrameRow,
  StoryProScriptHubNodeData,
  StoryProVideoRow,
} from "@/lib/canvas/story-pro-workspace-types";
import { useCanvasStore } from "@/lib/canvas/store";
import type { CanvasFlowNode, CanvasNodeRuntime } from "@/lib/canvas/types";
import { convertWizardMentionTokensToDockRefs } from "@/lib/canvas/pro2-production-wizard-frame-mount";
import { syncPro2FrameImagesFromRows } from "@/lib/canvas/pro2-spawn-frame-image-group";
import { syncPro2VideoBoardFromRows } from "@/lib/canvas/pro2-spawn-video-board-group";
import {
  isAnyStoryFrameColumnType,
  isAnyStoryVideoColumnType,
} from "@/lib/canvas/story-workspace-resolver";

function runtimeFromPreviewUrl(
  previewUrl: string,
  taskId?: string,
): CanvasNodeRuntime {
  const url = previewUrl.trim();
  return {
    status: "done",
    taskId: taskId?.trim() || undefined,
    ossUrl: url,
    failCode: undefined,
    failMessage: undefined,
  };
}

function ensureHubFrameVideoRows(
  hubData: StoryProScriptHubNodeData,
  scriptHubId: string,
): { frameRows: StoryProFrameRow[]; videoRows: StoryProVideoRow[] } {
  const synced = syncStoryProColumnRows(
    hubData,
    {
      characterRows: hubData.scriptStudioCharacterRows,
      sceneRows: hubData.sceneRows,
      frameRows: hubData.scriptStudioFrameRows,
      videoRows: hubData.scriptStudioVideoRows,
    },
    scriptHubId,
  );
  return {
    frameRows: synced.frameRows as StoryProFrameRow[],
    videoRows: synced.videoRows as StoryProVideoRow[],
  };
}

function rowPreviewUrl(
  runtime?: CanvasNodeRuntime | null,
): string | undefined {
  return runtime?.ossUrl?.trim() || runtime?.ephemeralUrl?.trim() || undefined;
}

export function buildWizardShotMountHubPatch(
  hubData: StoryProScriptHubNodeData,
  scriptHubId: string,
  mediaKind: Pro2WizardShotMediaKind,
  shotIndex: number,
  previewUrl: string,
  taskId?: string,
  draftPrompt?: string,
): Partial<StoryProScriptHubNodeData> | null {
  const url = previewUrl.trim();
  if (!url) return null;

  const rowKey = shotRowKey(shotIndex);
  const runtime = runtimeFromPreviewUrl(url, taskId);
  const { frameRows, videoRows } = ensureHubFrameVideoRows(hubData, scriptHubId);
  const dockPrompt = draftPrompt?.trim()
    ? convertWizardMentionTokensToDockRefs(
        draftPrompt.trim(),
        hubData.productionScript,
        scriptHubId,
        hubData.sceneRows ?? [],
      )
    : "";

  if (mediaKind === "frame") {
    if (!frameRows.some((r) => r.key === rowKey)) return null;
    let nextRows = applyFrameRowRuntime(frameRows, rowKey, runtime);
    if (dockPrompt) {
      nextRows = nextRows.map((r) =>
        r.key === rowKey ? { ...r, prompt: dockPrompt } : r,
      );
    }
    nextRows = nextRows.map((r) =>
      r.key === rowKey
        ? {
            ...r,
            frameApprovedAt: r.frameApprovedAt ?? new Date().toISOString(),
          }
        : r,
    );
    const nextVideoRows = videoRows.map((v) =>
      v.key === rowKey ? { ...v, frameImageUrl: url } : v,
    );
    return {
      scriptStudioFrameRows: nextRows,
      scriptStudioVideoRows: nextVideoRows,
    };
  }

  if (!videoRows.some((r) => r.key === rowKey)) return null;
  let nextVideoRows = applyVideoRowRuntime(videoRows, rowKey, "video", runtime);
  if (dockPrompt) {
    nextVideoRows = nextVideoRows.map((r) =>
      r.key === rowKey ? { ...r, videoPrompt: dockPrompt } : r,
    );
  }
  return { scriptStudioVideoRows: nextVideoRows };
}

export function isWizardShotPreviewMounted(
  hubData: StoryProScriptHubNodeData,
  scriptHubId: string,
  mediaKind: Pro2WizardShotMediaKind,
  shotIndex: number,
  previewUrl: string,
): boolean {
  const url = previewUrl.trim();
  if (!url) return false;
  const rowKey = shotRowKey(shotIndex);
  const { frameRows, videoRows } = ensureHubFrameVideoRows(hubData, scriptHubId);

  if (mediaKind === "frame") {
    const row = frameRows.find((r) => r.key === rowKey);
    return rowPreviewUrl(row?.runtime) === url;
  }
  const row = videoRows.find((r) => r.key === rowKey);
  return rowPreviewUrl(row?.videoRuntime) === url;
}

export function remountAllWizardShotDraftsToHub(scriptHubId: string): number {
  const state = useCanvasStore.getState();
  const hub = state.nodes.find((n) => n.id === scriptHubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return 0;

  let hubData = hub.data as StoryProScriptHubNodeData;
  let mounted = 0;

  for (const [key, draft] of Object.entries(
    hubData.productionWizardShotDrafts ?? {},
  )) {
    const url = draft.previewUrl?.trim();
    if (!url || draft.generateStatus === "running") continue;
    const parsed = parseWizardShotDraftKey(key);
    if (!parsed) continue;
    const { mediaKind, shotIndex } = parsed;
    if (
      isWizardShotPreviewMounted(
        hubData,
        scriptHubId,
        mediaKind,
        shotIndex,
        url,
      )
    ) {
      continue;
    }
    mountWizardShotPreviewToHub(
      scriptHubId,
      mediaKind,
      shotIndex,
      url,
      draft.taskId,
      draft.prompt,
    );
    mounted += 1;
    const nextHub = useCanvasStore
      .getState()
      .nodes.find((n) => n.id === scriptHubId);
    if (nextHub) hubData = nextHub.data as StoryProScriptHubNodeData;
  }

  return mounted;
}

export function mountWizardShotPreviewToHub(
  scriptHubId: string,
  mediaKind: Pro2WizardShotMediaKind,
  shotIndex: number,
  previewUrl: string,
  taskId?: string,
  draftPrompt?: string,
): void {
  const { nodes, updateNodeData } = useCanvasStore.getState();
  const hub = nodes.find((n) => n.id === scriptHubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return;

  const hubData = hub.data as StoryProScriptHubNodeData;
  const mountPatch = buildWizardShotMountHubPatch(
    hubData,
    scriptHubId,
    mediaKind,
    shotIndex,
    previewUrl,
    taskId,
    draftPrompt,
  );
  if (!mountPatch) return;

  updateNodeData(scriptHubId, mountPatch);

  const rowKey = shotRowKey(shotIndex);
  const ws = (hubData.workspaceIds ?? {}) as { frameColumnId?: string; videoColumnId?: string };
  const frameColumnId = resolveHubColumnId(
    nodes,
    scriptHubId,
    ws.frameColumnId,
    isAnyStoryFrameColumnType,
  );
  const videoColumnId = resolveHubColumnId(
    nodes,
    scriptHubId,
    ws.videoColumnId,
    isAnyStoryVideoColumnType,
  );

  if (mountPatch.scriptStudioFrameRows && frameColumnId) {
    updateNodeData(frameColumnId, {
      rows: mountPatch.scriptStudioFrameRows,
      hubNodeId: scriptHubId,
    });
    const live = useCanvasStore.getState();
    syncPro2FrameImagesFromRows(
      live.nodes,
      frameColumnId,
      mountPatch.scriptStudioFrameRows.filter((r) => r.key === rowKey),
      live.updateNodeData,
    );
  }
  if (mountPatch.scriptStudioVideoRows && videoColumnId) {
    updateNodeData(videoColumnId, {
      rows: mountPatch.scriptStudioVideoRows,
      hubNodeId: scriptHubId,
      frameColumnId,
    });
    if (mediaKind === "video") {
      const live = useCanvasStore.getState();
      syncPro2VideoBoardFromRows(
        live.nodes,
        videoColumnId,
        mountPatch.scriptStudioVideoRows.filter((r) => r.key === rowKey),
        live.updateNodeData,
        live.edges,
      );
    }
  }
}

function resolveHubColumnId(
  nodes: CanvasFlowNode[],
  scriptHubId: string,
  preferredId: string | undefined,
  isColumnType: (type: string) => boolean,
): string | undefined {
  if (preferredId && nodes.some((n) => n.id === preferredId)) return preferredId;
  return nodes.find(
    (n) =>
      isColumnType(n.type ?? "") &&
      (n.data as { hubNodeId?: string }).hubNodeId === scriptHubId,
  )?.id;
}
