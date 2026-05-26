"use client";

import { listCanvasProjectTasks, runCanvasNode } from "@/lib/canvas-api";
import type { CanvasTaskRecord } from "@/lib/canvas-api";
import { useCanvasStore } from "@/lib/canvas/store";
import { frameRowsForVideoSync } from "@/lib/canvas/story-column-display";
import { patchVideoRowsFromFrameRows } from "@/lib/canvas/story-column-sync";
import { formatCanvasTaskError } from "@/lib/canvas/friendly-task-error";
import { applyVideoRowRuntime } from "@/lib/canvas/story-row-patch";
import { storyApplyTaskResult } from "@/lib/canvas/story-run-apply";
import type { CanvasEnginePick } from "@/lib/canvas/types";
import type {
  StoryFrameRow,
  StoryVideoColumnNodeData,
  StoryVideoRow,
} from "@/lib/canvas/story-workspace-types";

export type StoryVideoRunArgs = {
  base: string | null;
  projectId: string | null;
  videoColumnId: string;
  frameColumnId: string;
  rowKey: string;
  batchVideo: CanvasEnginePick;
  /** UI 上已显示的分镜图 URL，避免 store 与 display 不一致导致静默失败 */
  frameImageUrl?: string;
  forceFresh?: boolean;
};

export type StoryVideoRunResult =
  | { ok: true; taskStatus: string }
  | { ok: false; error: string };

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_TICKS = 600;

function patchVideoRowsForRun(
  videoStored: StoryVideoRow[],
  frameRows: StoryFrameRow[],
  rowKey: string,
  frameImageUrlOverride?: string,
): StoryVideoRow[] | null {
  let patched = patchVideoRowsFromFrameRows(videoStored, frameRows);
  const frameRow = frameRows.find((r) => r.key === rowKey);
  const frameUrl =
    frameImageUrlOverride?.trim() ||
    frameRow?.runtime?.ossUrl ||
    frameRow?.runtime?.ephemeralUrl;
  if (!frameUrl) return null;
  patched = patched.map((v) =>
    v.key === rowKey ? { ...v, frameImageUrl: frameUrl } : v,
  );
  return patched;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function pollStoryVideoTaskUntilSettled(
  base: string,
  projectId: string,
  videoColumnId: string,
  rowKey: string,
  taskId: string,
): Promise<CanvasTaskRecord | null> {
  for (let i = 0; i < MAX_POLL_TICKS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const tasks = await listCanvasProjectTasks(base, projectId, [
      videoColumnId,
    ]);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) continue;
    const updateNodeData = useCanvasStore.getState().updateNodeData;
    const node =
      useCanvasStore.getState().nodes.find((n) => n.id === videoColumnId) ??
      null;
    if (node) {
      storyApplyTaskResult(
        node,
        task,
        { rowKey, mediaKind: "video" },
        updateNodeData,
        useCanvasStore.getState().nodes,
      );
    }
    if (task.status === "SUCCEEDED" || task.status === "FAILED") {
      return task;
    }
  }
  return null;
}

/** 分镜视频 · 同步行数据后直接调 run API（不经过 run-queue，避免 inflight 静默丢弃） */
export async function commitStoryVideoRowRun(
  args: StoryVideoRunArgs,
): Promise<StoryVideoRunResult> {
  const {
    base,
    projectId,
    videoColumnId,
    frameColumnId,
    rowKey,
    batchVideo,
    frameImageUrl,
    forceFresh = true,
  } = args;

  if (!base?.trim() || !projectId?.trim()) {
    return { ok: false, error: "画布未就绪，请刷新页面后重试。" };
  }

  const updateNodeData = useCanvasStore.getState().updateNodeData;
  const state = useCanvasStore.getState();
  const videoNode = state.nodes.find((n) => n.id === videoColumnId);
  if (!videoNode || videoNode.type !== "story-video-column") {
    return { ok: false, error: "找不到分镜视频列，请检查工作区是否完整。" };
  }

  const frameStored =
    (
      state.nodes.find((n) => n.id === frameColumnId)?.data as {
        rows?: StoryFrameRow[];
      }
    )?.rows ?? [];
  const frameRows = frameRowsForVideoSync(state.nodes, frameColumnId, frameStored);
  const videoStored =
    (videoNode.data as StoryVideoColumnNodeData).rows ?? [];
  const patched = patchVideoRowsForRun(
    videoStored,
    frameRows,
    rowKey,
    frameImageUrl,
  );
  if (!patched?.length) {
    return {
      ok: false,
      error: "无法生成分镜视频：请先生成该镜的分镜图。",
    };
  }

  const videoPick = {
    providerId: batchVideo.providerId,
    modelKey: batchVideo.modelKey,
    params: batchVideo.params ?? {},
  };

  const rowsPending = applyVideoRowRuntime(patched, rowKey, "video", {
    status: "pending",
    failCode: undefined,
    failMessage: undefined,
  });

  updateNodeData(videoColumnId, {
    rows: rowsPending,
    batchVideo: videoPick,
    frameColumnId,
  });

  const nodeAfter =
    useCanvasStore.getState().nodes.find((n) => n.id === videoColumnId) ??
    videoNode;

  try {
    const r = await runCanvasNode(base, projectId, videoColumnId, {
      node: {
        type: "story-video-column",
        data: nodeAfter.data as Record<string, unknown>,
        imageInputs: [],
        textInputs: [],
      },
      forceFresh,
      rowKey,
      mediaKind: "video",
    });
    let task = r.task;
    storyApplyTaskResult(
      nodeAfter,
      task,
      { rowKey, mediaKind: "video" },
      updateNodeData,
      useCanvasStore.getState().nodes,
    );

    if (task.status === "PENDING" || task.status === "SUBMITTED") {
      const settled = await pollStoryVideoTaskUntilSettled(
        base,
        projectId,
        videoColumnId,
        rowKey,
        task.id,
      );
      if (settled) task = settled;
    }

    if (task.status === "FAILED") {
      return {
        ok: false,
        error: formatCanvasTaskError(task.failCode, task.failMessage),
      };
    }

    return { ok: true, taskStatus: task.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const friendly = formatCanvasTaskError("REQUEST_FAILED", msg);
    storyApplyTaskResult(
      nodeAfter,
      {
        id: "",
        nodeId: videoColumnId,
        kind: "IMAGE",
        status: "FAILED",
        model: "",
        ossUrl: null,
        ephemeralUrl: null,
        textOutput: null,
        failCode: "REQUEST_FAILED",
        failMessage: msg,
        submittedAt: null,
        completedAt: null,
        createdAt: "",
        updatedAt: "",
      },
      { rowKey, mediaKind: "video" },
      updateNodeData,
      useCanvasStore.getState().nodes,
    );
    return { ok: false, error: friendly };
  }
}
