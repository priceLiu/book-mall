"use client";

import { runCanvasNode } from "@/lib/canvas-api";
import { buildCanvasRunSnapshot } from "@/lib/canvas/canvas-run-snapshot";
import { useCanvasStore } from "@/lib/canvas/store";
import { formatCanvasTaskError } from "@/lib/canvas/friendly-task-error";
import { applyVideoRowRuntime } from "@/lib/canvas/story-row-patch";
import { storyApplyTaskResult } from "@/lib/canvas/story-run-apply";
import { resolveStoryProRunStylePayload } from "@/lib/canvas/story-pro-run-style-context";
import type { CanvasEnginePick } from "@/lib/canvas/types";
import type {
  StoryVideoColumnNodeData,
  StoryVideoRow,
} from "@/lib/canvas/story-workspace-types";

export type StoryTtsRunArgs = {
  base: string | null;
  projectId: string | null;
  videoColumnId: string;
  rowKey: string;
  batchTts: CanvasEnginePick;
  /** 台词文本（对白列 / ttsPrompt） */
  dialogue: string;
  forceFresh?: boolean;
};

export type StoryTtsRunResult =
  | { ok: true; taskStatus: string }
  | { ok: false; error: string };

const ttsRowRunInflight = new Map<string, Promise<StoryTtsRunResult>>();

function ttsRowRunLockKey(videoColumnId: string, rowKey: string): string {
  return `tts:${videoColumnId}:${rowKey}`;
}

export function storyTtsDialogueText(row: StoryVideoRow): string {
  return (row.ttsPrompt ?? row.dialogue ?? "").trim();
}

export function storyTtsGenerateBlockReason(
  row: StoryVideoRow | undefined,
): string | null {
  if (!row) return "找不到对应分镜行";
  const text = storyTtsDialogueText(row);
  if (!text || text === "—" || text === "-") {
    return "本镜无对白 · 请在分镜表「对白」列填写台词";
  }
  return null;
}

async function commitStoryTtsRowRunOnce(
  args: StoryTtsRunArgs,
): Promise<StoryTtsRunResult> {
  const {
    base,
    projectId,
    videoColumnId,
    rowKey,
    batchTts,
    dialogue,
    forceFresh = true,
  } = args;

  if (!base?.trim() || !projectId?.trim()) {
    return { ok: false, error: "画布未就绪，请刷新页面后重试。" };
  }

  const text = dialogue.trim();
  if (!text || text === "—" || text === "-") {
    return {
      ok: false,
      error: "本镜无对白，请先在分镜表「对白」列填写台词后再合成配音。",
    };
  }

  if (!batchTts.providerId?.trim() || !batchTts.modelKey?.trim()) {
    return { ok: false, error: "请先在分镜视频列选择 TTS 配音模型。" };
  }

  const updateNodeData = useCanvasStore.getState().updateNodeData;
  const videoNode = useCanvasStore.getState().nodes.find(
    (n) => n.id === videoColumnId,
  );
  if (
    !videoNode ||
    (videoNode.type !== "story-video-column" &&
      videoNode.type !== "story-pro-video")
  ) {
    return { ok: false, error: "找不到分镜视频列。" };
  }

  const stored = (videoNode.data as StoryVideoColumnNodeData).rows ?? [];
  const row = stored.find((r) => r.key === rowKey);
  const earlySt = row?.ttsRuntime?.status ?? "idle";
  if (earlySt === "pending" || earlySt === "running") {
    return { ok: false, error: "本镜配音正在生成中，请稍候。" };
  }

  const rowsPending = applyVideoRowRuntime(stored, rowKey, "tts", {
    status: "pending",
    failCode: undefined,
    failMessage: undefined,
  });

  updateNodeData(videoColumnId, {
    rows: rowsPending,
    batchTts: {
      providerId: batchTts.providerId,
      modelKey: batchTts.modelKey,
      params: batchTts.params ?? {},
    },
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
        data: {
          ...(nodeAfter.data as Record<string, unknown>),
          rows: rowsPending,
          batchTts: {
            providerId: batchTts.providerId,
            modelKey: batchTts.modelKey,
            params: batchTts.params ?? {},
          },
        },
        imageInputs: [],
        textInputs: [],
      },
      forceFresh,
      rowKey,
      mediaKind: "tts",
      canvasSnapshot: buildCanvasRunSnapshot(),
      ...stylePayload,
    });
    const task = r.task;
    storyApplyTaskResult(
      nodeAfter,
      task,
      { rowKey, mediaKind: "tts" },
      updateNodeData,
      useCanvasStore.getState().nodes,
    );

    if (task.status === "FAILED") {
      return {
        ok: false,
        error: formatCanvasTaskError(task.failCode, task.failMessage),
      };
    }

    return { ok: true, taskStatus: task.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const is409 =
      msg.includes("409") || msg.includes("TASK_ALREADY_INFLIGHT");
    if (is409) {
      return { ok: false, error: "本镜配音正在生成中，请稍候。" };
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
        kieTaskId: null,
        createdAt: "",
        updatedAt: "",
      },
      { rowKey, mediaKind: "tts" },
      updateNodeData,
      useCanvasStore.getState().nodes,
    );
    return {
      ok: false,
      error: formatCanvasTaskError("REQUEST_FAILED", msg),
    };
  }
}

/** 分镜视频列 · 按镜 TTS（Gateway · 百炼，同步落 OSS） */
export function commitStoryTtsRowRun(
  args: StoryTtsRunArgs,
): Promise<StoryTtsRunResult> {
  const lockKey = ttsRowRunLockKey(args.videoColumnId, args.rowKey);
  const existing = ttsRowRunInflight.get(lockKey);
  if (existing) return existing;

  const promise = commitStoryTtsRowRunOnce(args).finally(() => {
    ttsRowRunInflight.delete(lockKey);
  });
  ttsRowRunInflight.set(lockKey, promise);
  return promise;
}
