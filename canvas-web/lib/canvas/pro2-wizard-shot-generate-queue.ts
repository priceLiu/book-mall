"use client";

import {
  cancelCanvasGenerationTask,
  listCanvasProjectTasks,
} from "@/lib/canvas-api";
import { clearCanvasNodeRunSession } from "@/lib/canvas/canvas-run-session";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import {
  WIZARD_SHOT_MEDIA_LABEL,
  wizardShotDraftKey,
  type Pro2WizardShotMediaKind,
} from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import { patchProductionWizardShotDraft } from "@/lib/canvas/pro2-wizard-shot-draft-patch";
import {
  finishWizardAssetProgressItem,
  markWizardShotVideoBackgroundWait,
  upsertWizardAssetProgressItem,
} from "@/lib/canvas/pro2-wizard-asset-progress";
import { pickRecoverableWizardShotTask } from "@/lib/canvas/pro2-wizard-shot-recover";
import {
  isWizardShotTaskSettled,
  isWizardShotTaskStaleInflight,
  resolveWizardShotRunResult,
  submitPro2WizardShotRun,
  waitPro2WizardShotTask,
  wizardShotRunnerNodeId,
  type RunPro2WizardShotGenerateArgs,
  type WizardShotTaskRecord,
} from "@/lib/canvas/pro2-wizard-shot-media-run";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";

export type EnqueueWizardShotGenerateArgs = {
  scriptHubId: string;
  mediaKind: Pro2WizardShotMediaKind;
  shotIndex: number;
  base: string;
  projectId: string;
  prompt: string;
  refImages: StoryRefImage[];
  script?: Pro2ProductionScript;
  frameSettings?: Sbv1ImageNodeData;
  videoEngine?: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  };
  framePreviewUrl?: string;
  dialogue?: string;
  resumeTaskId?: string;
};

const activeByShotKey = new Set<string>();

const SERVER_INFLIGHT = new Set<WizardShotTaskRecord["status"]>([
  "QUEUED",
  "DISPATCHING",
  "PENDING",
  "SUBMITTED",
]);

type WizardShotResumePlan =
  | { kind: "done"; result: { previewUrl: string; taskId: string } }
  | { kind: "poll"; taskId: string }
  | { kind: "submit"; cancelTaskId?: string }
  | { kind: "terminal_error"; error: string; taskId: string };

function patchDraft(
  args: Pick<
    EnqueueWizardShotGenerateArgs,
    "scriptHubId" | "mediaKind" | "shotIndex"
  >,
  patch: Parameters<typeof patchProductionWizardShotDraft>[3],
  opts?: { sessionOnly?: boolean },
): void {
  patchProductionWizardShotDraft(
    args.scriptHubId,
    args.mediaKind,
    args.shotIndex,
    patch,
    opts,
  );
}

function toRunArgs(
  args: EnqueueWizardShotGenerateArgs,
): RunPro2WizardShotGenerateArgs {
  return {
    base: args.base,
    projectId: args.projectId,
    scriptHubId: args.scriptHubId,
    mediaKind: args.mediaKind,
    shotIndex: args.shotIndex,
    prompt: args.prompt,
    refImages: args.refImages,
    script: args.script,
    frameSettings: args.frameSettings,
    videoEngine: args.videoEngine,
    framePreviewUrl: args.framePreviewUrl,
    dialogue: args.dialogue,
  };
}

function applyWizardShotSuccess(
  args: EnqueueWizardShotGenerateArgs,
  result: { previewUrl: string; taskId: string },
  jobId: string,
): void {
  patchDraft(args, {
    previewUrl: result.previewUrl,
    generateStatus: "idle",
    taskId: result.taskId,
    failMessage: undefined,
    ...(args.mediaKind === "frame"
      ? {}
      : { framePreviewUrl: args.framePreviewUrl }),
  });
  finishWizardAssetProgressItem(jobId, "succeeded");
}

/** 恢复轮询前：已成功则直接写回；终态失败/僵尸/无任务则改走新 submit */
async function resolveWizardShotResumePlan(
  args: EnqueueWizardShotGenerateArgs,
  nodeId: string,
  resumeTaskId: string,
): Promise<WizardShotResumePlan> {
  const tasks = (await listCanvasProjectTasks(args.base, args.projectId, [
    nodeId,
  ])) as WizardShotTaskRecord[] | null;

  const trimmedTaskId = resumeTaskId.trim();
  if (!trimmedTaskId) return { kind: "submit" };

  if (tasks?.length) {
    const recoverable = pickRecoverableWizardShotTask(
      tasks,
      trimmedTaskId,
      nodeId,
    );
    if (recoverable?.status === "SUCCEEDED") {
      const settled = resolveWizardShotRunResult(recoverable);
      if (settled.ok) {
        return { kind: "done", result: settled };
      }
    }

    const bound = tasks.find((t) => t.id === trimmedTaskId);
    if (bound) {
      if (bound.status === "SUCCEEDED") {
        const settled = resolveWizardShotRunResult(bound);
        if (settled.ok) {
          return { kind: "done", result: settled };
        }
        return {
          kind: "terminal_error",
          error: settled.error,
          taskId: bound.id,
        };
      }
      if (bound.status === "FAILED" || bound.status === "CANCELLED") {
        return { kind: "submit" };
      }
      if (isWizardShotTaskStaleInflight(bound)) {
        return { kind: "submit", cancelTaskId: bound.id };
      }
      if (SERVER_INFLIGHT.has(bound.status)) {
        return { kind: "poll", taskId: trimmedTaskId };
      }
      if (isWizardShotTaskSettled(bound)) {
        const settled = resolveWizardShotRunResult(bound);
        if (settled.ok) {
          return { kind: "done", result: settled };
        }
      }
      return { kind: "submit", cancelTaskId: bound.id };
    }
  }

  if (trimmedTaskId && !tasks?.length) {
    return { kind: "submit" };
  }

  return { kind: "submit" };
}

async function runWizardShotJob(args: EnqueueWizardShotGenerateArgs) {
  const shotKey = wizardShotDraftKey(args.mediaKind, args.shotIndex);
  const jobId = shotKey;
  const nodeId = wizardShotRunnerNodeId(
    args.scriptHubId,
    args.mediaKind,
    args.shotIndex,
  );
  const label = `镜 ${args.shotIndex} · ${WIZARD_SHOT_MEDIA_LABEL[args.mediaKind]}`;

  upsertWizardAssetProgressItem({
    jobId,
    label,
    kind: args.mediaKind,
    status: "running",
    startedAt: Date.now(),
    minimized: true,
  });
  patchDraft(args, {
    generateStatus: "running",
    failMessage: undefined,
  });

  let lastTaskId = args.resumeTaskId?.trim() ?? "";

  try {
    let taskId = lastTaskId;
    let cancelBeforeSubmit = "";

    if (taskId) {
      const plan = await resolveWizardShotResumePlan(args, nodeId, taskId);
      if (plan.kind === "done") {
        applyWizardShotSuccess(args, plan.result, jobId);
        return;
      }
      if (plan.kind === "terminal_error") {
        patchDraft(args, {
          generateStatus: "failed",
          failMessage: plan.error,
          taskId: plan.taskId,
        });
        finishWizardAssetProgressItem(jobId, "failed", plan.error);
        return;
      }
      if (plan.kind === "poll") {
        taskId = plan.taskId;
      } else {
        cancelBeforeSubmit = plan.cancelTaskId?.trim() ?? taskId;
        taskId = "";
      }
    }

    if (!taskId) {
      if (cancelBeforeSubmit) {
        try {
          await cancelCanvasGenerationTask(
            args.base,
            args.projectId,
            cancelBeforeSubmit,
          );
        } catch {
          /* 僵尸任务可能已终态，忽略 cancel 失败 */
        }
      }
      const submitted = await submitPro2WizardShotRun(toRunArgs(args));
      if (!submitted.ok) {
        patchDraft(args, {
          generateStatus: "failed",
          failMessage: submitted.error,
        });
        finishWizardAssetProgressItem(jobId, "failed", submitted.error);
        return;
      }
      taskId = submitted.task.id;
      lastTaskId = taskId;
      /** 与画布 task 一致：taskId 落库，刷新后靠 /tasks + recover 续轮询 */
      patchDraft(args, { taskId, generateStatus: "running" });
    }

    lastTaskId = taskId;
    const task = await waitPro2WizardShotTask(
      args.base,
      args.projectId,
      taskId,
      nodeId,
    );

    const result = resolveWizardShotRunResult(task);
    if (!result.ok) {
      patchDraft(args, {
        generateStatus: "failed",
        failMessage: result.error,
        taskId,
      });
      finishWizardAssetProgressItem(jobId, "failed", result.error);
      return;
    }

    applyWizardShotSuccess(args, result, jobId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isVideoTimeout =
      args.mediaKind === "video" &&
      (msg.includes("生成超时") || msg.includes("长时间未推进"));
    if (isVideoTimeout) {
      markWizardShotVideoBackgroundWait({ jobId, label });
      patchDraft(args, {
        generateStatus: "running",
        failMessage: undefined,
        ...(lastTaskId ? { taskId: lastTaskId } : {}),
      });
      return;
    }
    patchDraft(args, {
      generateStatus: "failed",
      failMessage: msg || "生成失败",
    });
    finishWizardAssetProgressItem(jobId, "failed", msg || "生成失败");
  } finally {
    clearCanvasNodeRunSession(nodeId);
    activeByShotKey.delete(shotKey);
  }
}

export function isWizardShotGenerateActive(
  mediaKind: Pro2WizardShotMediaKind,
  shotIndex: number,
): boolean {
  return activeByShotKey.has(wizardShotDraftKey(mediaKind, shotIndex));
}

export function enqueueWizardShotGenerate(
  args: EnqueueWizardShotGenerateArgs,
): boolean {
  const shotKey = wizardShotDraftKey(args.mediaKind, args.shotIndex);
  if (activeByShotKey.has(shotKey) && !args.resumeTaskId) {
    return false;
  }
  activeByShotKey.add(shotKey);
  void runWizardShotJob(args);
  return true;
}

export function resumeWizardShotGenerate(
  args: EnqueueWizardShotGenerateArgs & { taskId: string },
): void {
  if (!args.taskId.trim()) return;
  enqueueWizardShotGenerate({ ...args, resumeTaskId: args.taskId });
}
