"use client";

import { clearCanvasNodeRunSession } from "@/lib/canvas/canvas-run-session";
import type { Pro2WizardAssetKind } from "@/lib/canvas/pro2-production-wizard-assets";
import { wizardAssetDraftKey } from "@/lib/canvas/pro2-production-wizard-assets";
import { patchProductionWizardAssetDraft } from "@/lib/canvas/pro2-wizard-asset-draft-patch";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import {
  finishWizardAssetProgressItem,
  upsertWizardAssetProgressItem,
} from "@/lib/canvas/pro2-wizard-asset-progress";
import {
  resolveWizardAssetImageRunResult,
  submitPro2WizardAssetImageRun,
  waitPro2WizardAssetImageTask,
  wizardAssetRunnerNodeId,
  type RunPro2WizardAssetImageGenerateArgs,
} from "@/lib/canvas/pro2-wizard-asset-image-run";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";

export type EnqueueWizardAssetGenerateArgs = {
  label: string;
  scriptHubId: string;
  kind: Pro2WizardAssetKind;
  assetId: string;
  base: string;
  projectId: string;
  settings: Sbv1ImageNodeData;
  prompt: string;
  refImages: StoryRefImage[];
  script?: Pro2ProductionScript;
  /** 仅轮询已有 task（刷新/重进向导恢复） */
  resumeTaskId?: string;
};

const activeByAssetKey = new Set<string>();

function jobIdFor(kind: Pro2WizardAssetKind, assetId: string): string {
  return wizardAssetDraftKey(kind, assetId);
}

function patchDraft(
  args: Pick<
    EnqueueWizardAssetGenerateArgs,
    "scriptHubId" | "kind" | "assetId"
  >,
  patch: Parameters<typeof patchProductionWizardAssetDraft>[3],
  opts?: { sessionOnly?: boolean },
): void {
  patchProductionWizardAssetDraft(
    args.scriptHubId,
    args.kind,
    args.assetId,
    patch,
    opts,
  );
}

function toRunArgs(
  args: EnqueueWizardAssetGenerateArgs,
): RunPro2WizardAssetImageGenerateArgs {
  return {
    base: args.base,
    projectId: args.projectId,
    scriptHubId: args.scriptHubId,
    kind: args.kind,
    assetId: args.assetId,
    settings: args.settings,
    prompt: args.prompt,
    refImages: args.refImages,
    script: args.script,
  };
}

async function runWizardAssetJob(args: EnqueueWizardAssetGenerateArgs) {
  const assetKey = wizardAssetDraftKey(args.kind, args.assetId);
  const jobId = jobIdFor(args.kind, args.assetId);
  const nodeId = wizardAssetRunnerNodeId(
    args.scriptHubId,
    args.kind,
    args.assetId,
  );

  upsertWizardAssetProgressItem({
    jobId,
    label: args.label,
    kind: args.kind,
    status: "running",
    startedAt: Date.now(),
  });
  patchDraft(args, { generateStatus: "running", failMessage: undefined });

  try {
    let taskId = args.resumeTaskId?.trim() ?? "";

    if (!taskId) {
      const submitted = await submitPro2WizardAssetImageRun(toRunArgs(args));
      if (!submitted.ok) {
        patchDraft(args, {
          generateStatus: "failed",
          failMessage: submitted.error,
        });
        finishWizardAssetProgressItem(jobId, "failed", submitted.error);
        return;
      }
      taskId = submitted.task.id;
      patchDraft(args, { taskId, generateStatus: "running" });
    }

    const task = await waitPro2WizardAssetImageTask(
      args.base,
      args.projectId,
      taskId,
      nodeId,
    );

    const result = resolveWizardAssetImageRunResult(task);
    if (!result.ok) {
      patchDraft(args, {
        generateStatus: "failed",
        failMessage: result.error,
        taskId,
      });
      finishWizardAssetProgressItem(jobId, "failed", result.error);
      return;
    }

    patchDraft(args, {
      previewUrl: result.previewUrl,
      generateStatus: "idle",
      taskId: result.taskId,
      failMessage: undefined,
    });
    finishWizardAssetProgressItem(jobId, "succeeded");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    patchDraft(args, {
      generateStatus: "failed",
      failMessage: msg || "出图失败",
    });
    finishWizardAssetProgressItem(jobId, "failed", msg || "出图失败");
  } finally {
    clearCanvasNodeRunSession(nodeId);
    activeByAssetKey.delete(assetKey);
  }
}

/** 后台出图：提交后立即返回，轮询写回 draft + 右下角进度。 */
export function enqueueWizardAssetGenerate(
  args: EnqueueWizardAssetGenerateArgs,
): boolean {
  const assetKey = wizardAssetDraftKey(args.kind, args.assetId);
  if (activeByAssetKey.has(assetKey) && !args.resumeTaskId) {
    return false;
  }
  activeByAssetKey.add(assetKey);
  void runWizardAssetJob(args);
  return true;
}

export function resumeWizardAssetGenerate(
  args: EnqueueWizardAssetGenerateArgs & { taskId: string },
): void {
  if (!args.taskId.trim()) return;
  enqueueWizardAssetGenerate({ ...args, resumeTaskId: args.taskId });
}
