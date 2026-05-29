"use client";

import { listCanvasProjectTasks, runCanvasNode } from "@/lib/canvas-api";
import type { CanvasTaskRecord } from "@/lib/canvas-api";
import { useCanvasStore } from "@/lib/canvas/store";
import { frameRowsForVideoSync } from "@/lib/canvas/story-column-display";
import { patchVideoRowsFromFrameRows } from "@/lib/canvas/story-column-sync";
import { formatCanvasTaskError } from "@/lib/canvas/friendly-task-error";
import { applyVideoRowRuntime } from "@/lib/canvas/story-row-patch";
import { storyApplyTaskResult } from "@/lib/canvas/story-run-apply";
import { resolveStoryProRunStylePayload } from "@/lib/canvas/story-pro-run-style-context";
import { storyVideoGenerateBlockReason } from "@/lib/canvas/story-frame-gate";
import { tasksMatchStoryScope } from "@/lib/canvas/task-pick";
import type { CanvasEnginePick } from "@/lib/canvas/types";
import type {
  StoryFrameRow,
  StoryVideoColumnNodeData,
  StoryVideoRow,
} from "@/lib/canvas/story-workspace-types";
import type { CanvasFlowNode } from "@/lib/canvas/types";

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
  | { ok: true; taskStatus: string; taskId?: string }
  | { ok: false; error: string };

/** 同 tab · 同项目同镜合并为一次提交（防分镜列/视频列/运行全部 双入口竞态） */
const videoRowRunInflight = new Map<string, Promise<StoryVideoRunResult>>();

export function storyVideoRowRunLockKey(
  projectId: string,
  rowKey: string,
): string {
  return `${projectId}:video:${rowKey}`;
}

function isNetworkLikeError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("load failed") ||
    m.includes("aborted")
  );
}

function isInflightTaskStatus(status: string): boolean {
  return status === "PENDING" || status === "SUBMITTED";
}

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
  const frameScript = frameRow?.prompt?.trim();
  patched = patched.map((v) => {
    if (v.key !== rowKey) return v;
    return {
      ...v,
      frameImageUrl: frameUrl,
      ...(frameRow
        ? {
            videoPrompt: frameScript || v.videoPrompt,
            refImages: frameRow.refImages?.length
              ? frameRow.refImages
              : v.refImages,
            videoReferencedNodeIds:
              frameRow.referencedNodeIds ?? v.videoReferencedNodeIds,
          }
        : {}),
    };
  });
  return patched;
}

async function recoverInflightVideoTask(
  base: string,
  projectId: string,
  videoColumnId: string,
  rowKey: string,
  nodeAfter: CanvasFlowNode,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): Promise<CanvasTaskRecord | null> {
  try {
    const tasks = await listCanvasProjectTasks(base, projectId, [
      videoColumnId,
    ]);
    const scope = { rowKey, mediaKind: "video" as const };
    const inflight = tasks
      .filter(
        (t) =>
          t.nodeId === videoColumnId &&
          isInflightTaskStatus(t.status) &&
          tasksMatchStoryScope(t, scope),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    const pick = inflight[0];
    if (!pick) return null;
    storyApplyTaskResult(
      nodeAfter,
      pick,
      { rowKey, mediaKind: "video" },
      updateNodeData,
      useCanvasStore.getState().nodes,
    );
    return pick;
  } catch {
    return null;
  }
}

async function commitStoryVideoRowRunOnce(
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
  if (
    !videoNode ||
    (videoNode.type !== "story-video-column" &&
      videoNode.type !== "story-pro-video")
  ) {
    return { ok: false, error: "找不到分镜视频列，请检查工作区是否完整。" };
  }

  const frameStored =
    (
      state.nodes.find((n) => n.id === frameColumnId)?.data as {
        rows?: StoryFrameRow[];
      }
    )?.rows ?? [];
  const frameRows = frameRowsForVideoSync(
    state.nodes,
    frameColumnId,
    frameStored,
    state.edges,
  );
  const frameRow = frameRows.find((r) => r.key === rowKey);
  const blockReason = storyVideoGenerateBlockReason(frameRow);
  if (blockReason) {
    return { ok: false, error: blockReason };
  }

  const videoStoredEarly =
    (videoNode.data as StoryVideoColumnNodeData).rows ?? [];
  const videoRowEarly = videoStoredEarly.find((r) => r.key === rowKey);
  const earlySt = videoRowEarly?.videoRuntime?.status ?? "idle";
  if (earlySt === "pending" || earlySt === "running") {
    return { ok: false, error: "本镜视频正在生成中，请稍候。" };
  }

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
    const store = useCanvasStore.getState();
    const stylePayload = resolveStoryProRunStylePayload(
      store.nodes,
      store.edges,
      nodeAfter,
    );
    const r = await runCanvasNode(base, projectId, videoColumnId, {
      node: {
        type: videoNode.type,
        data: nodeAfter.data as Record<string, unknown>,
        imageInputs: [],
        textInputs: [],
      },
      forceFresh,
      rowKey,
      mediaKind: "video",
      ...stylePayload,
    });
    const task = r.task;
    storyApplyTaskResult(
      nodeAfter,
      task,
      { rowKey, mediaKind: "video" },
      updateNodeData,
      useCanvasStore.getState().nodes,
    );

    if (task.status === "FAILED") {
      return {
        ok: false,
        error: formatCanvasTaskError(task.failCode, task.failMessage),
      };
    }

    /** 已提交则视为成功；轮询由 run-queue + 服务端 poll worker 接管，避免 fetch 失败误报失败 */
    return { ok: true, taskStatus: task.status, taskId: task.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const is409 =
      msg.includes("409") || msg.includes("TASK_ALREADY_INFLIGHT");
    if (is409 || isNetworkLikeError(msg)) {
      const recovered = await recoverInflightVideoTask(
        base,
        projectId,
        videoColumnId,
        rowKey,
        nodeAfter,
        updateNodeData,
      );
      if (recovered) {
        return {
          ok: true,
          taskStatus: recovered.status,
          taskId: recovered.id,
        };
      }
      if (is409) {
        return { ok: false, error: "本镜视频正在生成中，请稍候。" };
      }
    }

    const friendly = isNetworkLikeError(msg)
      ? "网络中断，任务可能仍在 Gateway 生成中。请稍候刷新画布，勿重复点击。"
      : formatCanvasTaskError("REQUEST_FAILED", msg);

    const recovered = await recoverInflightVideoTask(
      base,
      projectId,
      videoColumnId,
      rowKey,
      nodeAfter,
      updateNodeData,
    );
    if (recovered) {
      return {
        ok: true,
        taskStatus: recovered.status,
        taskId: recovered.id,
      };
    }

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

/** 分镜视频 · 同步行数据后直接调 run API（不经过 run-queue，避免 inflight 静默丢弃） */
export function commitStoryVideoRowRun(
  args: StoryVideoRunArgs,
): Promise<StoryVideoRunResult> {
  const lockKey = storyVideoRowRunLockKey(
    args.projectId ?? "",
    args.rowKey,
  );
  const existing = videoRowRunInflight.get(lockKey);
  if (existing) return existing;

  const promise = commitStoryVideoRowRunOnce(args).finally(() => {
    videoRowRunInflight.delete(lockKey);
  });
  videoRowRunInflight.set(lockKey, promise);
  return promise;
}
