import type { CanvasTaskRecord } from "@/lib/canvas-api";
import type { CanvasNodeRuntime } from "./types";
import type { LibtvInpaintSession } from "./libtv-inpaint-session";
import type { Sbv1ImageNodeData } from "./sbv1-workspace-types";
import type { CanvasFlowNode } from "./types";
import { isCanvasManagedOssUrl } from "./canvas-managed-oss-url";
import { pickTaskImagePreviewUrl, taskHasDisplayableResult } from "./task-media-url";

const MAGIC_EDIT_SESSION_KEYS = [
  "libtvInpaintSession",
  "libtvEraseSession",
  "libtvCropSession",
  "libtvExpandSession",
] as const;

/** 节点当前选中的成功生图 task · autosave */
export type LibtvActiveImageTaskFields = {
  activeImageTaskId?: string;
};

export function libtvPinnedImageTaskId(
  data: LibtvActiveImageTaskFields & {
    runtime?: Pick<CanvasNodeRuntime, "taskId" | "status">;
  },
): string | undefined {
  const explicit = data.activeImageTaskId?.trim();
  if (explicit) return explicit;
  if (data.runtime?.status === "done") {
    return data.runtime.taskId?.trim() || undefined;
  }
  return undefined;
}

/** 任务轮询写回：done 且用户已选历史版本时，忽略其它 SUCCEEDED 任务 */
export function shouldSkipLibtvImageTaskPollApply(
  nodeData: LibtvActiveImageTaskFields & {
    runtime?: Pick<CanvasNodeRuntime, "taskId" | "status">;
  },
  task: CanvasTaskRecord,
): boolean {
  if (task.status !== "SUCCEEDED") return false;
  if (nodeData.runtime?.status !== "done") return false;
  const pinned = libtvPinnedImageTaskId(nodeData);
  if (!pinned) return false;
  return task.id !== pinned;
}

export function listSucceededImageGenerations(
  tasks: CanvasTaskRecord[],
): CanvasTaskRecord[] {
  return tasks
    .filter((t) => t.status === "SUCCEEDED" && taskHasDisplayableResult(t))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}

/** 同一预览 URL 只保留最后一次成功任务（轮询/重试不产生虚高版本数） */
export function dedupeSucceededImageGenerationsByMedia(
  tasks: CanvasTaskRecord[],
): CanvasTaskRecord[] {
  const sorted = listSucceededImageGenerations(tasks);
  const byKey = new Map<string, CanvasTaskRecord>();
  for (const t of sorted) {
    const url = pickTaskImagePreviewUrl(t)?.trim();
    const key = url || t.id;
    byKey.set(key, t);
  }
  return [...byKey.values()].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function resolveActiveImageTaskId(
  data: LibtvActiveImageTaskFields & {
    runtime?: Pick<CanvasNodeRuntime, "taskId"> | CanvasNodeRuntime;
  },
  succeeded: CanvasTaskRecord[],
): string | undefined {
  if (!succeeded.length) return undefined;
  const explicit = data.activeImageTaskId?.trim();
  if (explicit && succeeded.some((t) => t.id === explicit)) return explicit;
  const runtimeId = data.runtime?.taskId?.trim();
  if (runtimeId && succeeded.some((t) => t.id === runtimeId)) return runtimeId;
  return succeeded[succeeded.length - 1]?.id;
}

/** 成功任务 → 节点媒体槽（与 sbv1ImagePatchFromTask 成功分支一致） */
export function imageMediaPatchFromSucceededTask(
  prev: Pick<Sbv1ImageNodeData, "ossUrl" | "blobUrl">,
  task: CanvasTaskRecord,
): Record<string, unknown> | null {
  const previewUrl = pickTaskImagePreviewUrl(task);
  if (!previewUrl) return null;
  const hadImage = Boolean(prev.ossUrl?.trim() || prev.blobUrl?.trim());
  const taskOss = task.ossUrl?.trim();
  const managedOss = isCanvasManagedOssUrl(taskOss) ? taskOss : undefined;
  return {
    ...(managedOss
      ? {
          ossUrl: managedOss,
          blobUrl: undefined,
          imageMode: hadImage ? "img2img" : "txt2img",
        }
      : {}),
    uploading: false,
    uploadError: undefined,
    runtime: {
      status: "done",
      taskId: task.id,
      ossUrl: managedOss ?? previewUrl,
      ephemeralUrl: task.ephemeralUrl ?? undefined,
      failCode: undefined,
      failMessage: undefined,
    } satisfies CanvasNodeRuntime,
  };
}

function clearMagicEditSessionsOnData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const inpaint = data.libtvInpaintSession as LibtvInpaintSession | undefined;
  if (inpaint?.dockInputBeforeInpaint !== undefined) {
    data.dockInput = inpaint.dockInputBeforeInpaint;
  }
  for (const k of MAGIC_EDIT_SESSION_KEYS) {
    delete data[k];
  }
  delete data.libtvInpaintGenerating;
  delete data.libtvMagicEditGenerating;
  delete data.gridSplit;
  delete data.gridSplitCrop;
  delete data.gridSplitSourceUrl;
  return data;
}

/** 侧栏切换 active · 清编辑态并写回选中任务的 ossUrl/runtime */
export function applyActiveImageGenerationSwitch(
  nodeId: string,
  task: CanvasTaskRecord,
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
): void {
  setNodes((prev) =>
    prev.map((n) => {
      if (n.id !== nodeId) return n;
      const base = { ...(n.data as Record<string, unknown>) };
      clearMagicEditSessionsOnData(base);
      const mediaPatch = imageMediaPatchFromSucceededTask(
        base as Sbv1ImageNodeData,
        task,
      );
      if (!mediaPatch) return n;
      return {
        ...n,
        data: {
          ...base,
          ...mediaPatch,
          activeImageTaskId: task.id,
        },
      };
    }),
  );
}

export function previewUrlForGenerationTask(task: CanvasTaskRecord): string {
  return pickTaskImagePreviewUrl(task) ?? "";
}
