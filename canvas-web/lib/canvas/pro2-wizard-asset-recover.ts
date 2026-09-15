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
import type {
  Pro2ProductionWizardAssetDraft,
  Pro2WizardAssetKind,
} from "@/lib/canvas/pro2-production-wizard-assets";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { isUnstableTaskMediaUrl } from "@/lib/canvas/task-media-url";
import { useCanvasStore } from "@/lib/canvas/store";

function taskCompletedAtMs(task: WizardAssetTaskRecord): number {
  const raw = task.completedAt ?? task.updatedAt ?? task.createdAt;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function groupTasksByNodeId(
  tasks: WizardAssetTaskRecord[],
): Map<string, WizardAssetTaskRecord[]> {
  const map = new Map<string, WizardAssetTaskRecord[]>();
  for (const task of tasks) {
    const list = map.get(task.nodeId) ?? [];
    list.push(task);
    map.set(task.nodeId, list);
  }
  return map;
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

/** 缺 preview 或仅存厂商临时链（OSS 回写后须升级） */
export function wizardAssetDraftNeedsRecovery(
  draft: Pro2ProductionWizardAssetDraft,
): boolean {
  if (draft.generateStatus === "running") return false;
  const url = draft.previewUrl?.trim();
  if (!url) return true;
  return isUnstableTaskMediaUrl(url);
}

function previewUrlShouldUpgrade(
  current: string | undefined,
  next: string,
): boolean {
  const cur = current?.trim() ?? "";
  const nxt = next.trim();
  if (!nxt) return false;
  if (!cur) return true;
  if (cur === nxt) return false;
  if (isUnstableTaskMediaUrl(cur) && !isUnstableTaskMediaUrl(nxt)) return true;
  return false;
}

/**
 * draft 缺 previewUrl 但后台任务已成功 → 从 /tasks 补写 preview 并触发 Hub 挂载。
 * 覆盖「轮询写回丢失 / 陈旧闭包覆盖 / 厂商临时链过期」的历史数据。
 *
 * 使用 recovery 读道（非 lightweight 热窗口），否则 6h 外终态任务不可见。
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

  const targets: Array<{
    draft: Pro2ProductionWizardAssetDraft;
    nodeId: string;
    kind: Pro2WizardAssetKind;
    assetId: string;
  }> = [];

  for (const [key, draft] of Object.entries(drafts)) {
    if (!wizardAssetDraftNeedsRecovery(draft)) continue;
    const parsed = parseWizardAssetDraftKey(key);
    if (!parsed) continue;
    targets.push({
      draft,
      kind: parsed.kind,
      assetId: parsed.assetId,
      nodeId: wizardAssetRunnerNodeId(scriptHubId, parsed.kind, parsed.assetId),
    });
  }

  if (targets.length === 0) return 0;

  const nodeIds = targets.map((t) => t.nodeId);
  const allTasks = (await listCanvasProjectTasks(base, projectId, nodeIds, {
    recovery: true,
  })) as WizardAssetTaskRecord[] | null;
  const tasksByNode = groupTasksByNodeId(allTasks ?? []);

  let recovered = 0;

  for (const { draft, kind, assetId, nodeId } of targets) {
    const tasks = tasksByNode.get(nodeId) ?? [];
    if (!tasks.length) continue;

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

    if (
      !previewUrlShouldUpgrade(draft.previewUrl, result.previewUrl) &&
      draft.previewUrl?.trim()
    ) {
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
