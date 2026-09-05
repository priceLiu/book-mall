"use client";

import { listCanvasProjectTasks } from "@/lib/canvas-api";
import { patchProductionWizardAssetDraft } from "@/lib/canvas/pro2-wizard-asset-draft-patch";
import {
  parseWizardAssetDraftKey,
  wizardAssetDraftKey,
} from "@/lib/canvas/pro2-production-wizard-assets";
import {
  pickWizardAssetPollTask,
  pickWizardAssetTaskPreviewUrl,
  resolveWizardAssetImageRunResult,
  wizardAssetRunnerNodeId,
  type WizardAssetTaskRecord,
} from "@/lib/canvas/pro2-wizard-asset-image-run";
import type { Pro2ProductionWizardAssetDraft } from "@/lib/canvas/pro2-production-wizard-assets";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { useCanvasStore } from "@/lib/canvas/store";

function taskCompletedAtMs(task: WizardAssetTaskRecord): number {
  const raw = task.completedAt ?? task.updatedAt ?? task.createdAt;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

/** 从 /tasks 列表挑选可写回 draft 的终态任务 */
export function pickRecoverableWizardAssetTask(
  tasks: WizardAssetTaskRecord[],
  taskId: string | undefined,
  nodeId: string,
): WizardAssetTaskRecord | undefined {
  if (taskId?.trim()) {
    const bound = tasks.find((t) => t.id === taskId.trim());
    if (bound && pickWizardAssetTaskPreviewUrl(bound)) return bound;
    const polled = pickWizardAssetPollTask(tasks, taskId.trim(), nodeId);
    if (polled && pickWizardAssetTaskPreviewUrl(polled)) return polled;
  }

  const succeeded = tasks
    .filter(
      (t) =>
        t.nodeId === nodeId &&
        t.status === "SUCCEEDED" &&
        Boolean(pickWizardAssetTaskPreviewUrl(t)),
    )
    .sort((a, b) => taskCompletedAtMs(b) - taskCompletedAtMs(a));
  return succeeded[0];
}

function draftNeedsRecovery(draft: Pro2ProductionWizardAssetDraft): boolean {
  if (draft.generateStatus === "running") return false;
  if (draft.previewUrl?.trim()) return false;
  return true;
}

/**
 * draft 缺 previewUrl 但后台任务已成功 → 从 /tasks 补写 preview 并触发 Hub 挂载。
 * 覆盖「轮询写回丢失 / 陈旧闭包覆盖」的历史数据。
 */
export async function recoverWizardAssetDraftsFromTasks(
  scriptHubId: string,
  base: string,
  projectId: string,
): Promise<number> {
  const hub = useCanvasStore
    .getState()
    .nodes.find((n) => n.id === scriptHubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return 0;

  const hubData = hub.data as StoryProScriptHubNodeData;
  const drafts = hubData.productionWizardAssetDrafts ?? {};
  let recovered = 0;

  for (const [key, draft] of Object.entries(drafts)) {
    if (!draftNeedsRecovery(draft)) continue;
    const parsed = parseWizardAssetDraftKey(key);
    if (!parsed) continue;

    const { kind, assetId } = parsed;
    const nodeId = wizardAssetRunnerNodeId(scriptHubId, kind, assetId);
    const tasks = (await listCanvasProjectTasks(base, projectId, [
      nodeId,
    ])) as WizardAssetTaskRecord[] | null;
    if (!tasks?.length) continue;

    const task = pickRecoverableWizardAssetTask(
      tasks,
      draft.taskId,
      nodeId,
    );
    if (!task) continue;

    const result = resolveWizardAssetImageRunResult(task);
    if (!result.ok) {
      if (task.status === "FAILED" || task.status === "CANCELLED") {
        patchProductionWizardAssetDraft(scriptHubId, kind, assetId, {
          generateStatus: "failed",
          failMessage: result.error,
          taskId: task.id,
        });
      }
      continue;
    }

    patchProductionWizardAssetDraft(scriptHubId, kind, assetId, {
      previewUrl: result.previewUrl,
      generateStatus: "idle",
      taskId: result.taskId,
      failMessage: undefined,
    });
    recovered += 1;
  }

  return recovered;
}

export { wizardAssetDraftKey };
