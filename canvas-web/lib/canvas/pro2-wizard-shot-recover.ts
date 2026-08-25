"use client";

import { listCanvasProjectTasks } from "@/lib/canvas-api";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import {
  parseWizardShotDraftKey,
  WIZARD_SHOT_MEDIA_LABEL,
  wizardShotDraftKey,
  type Pro2WizardShotMediaKind,
} from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import type { Pro2ProductionWizardShotDraft } from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import { patchProductionWizardShotDraft } from "@/lib/canvas/pro2-wizard-shot-draft-patch";
import { upsertWizardAssetProgressItem } from "@/lib/canvas/pro2-wizard-asset-progress";
import {
  isWizardShotTaskInflight,
  pickWizardShotInflightTask,
  pickWizardShotPollTask,
  pickWizardShotTaskPreviewUrl,
  resolveWizardShotRunResult,
  wizardShotRunnerNodeId,
  type WizardShotTaskRecord,
} from "@/lib/canvas/pro2-wizard-shot-media-run";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { useCanvasStore } from "@/lib/canvas/store";

function taskCompletedAtMs(task: WizardShotTaskRecord): number {
  const raw = task.completedAt ?? task.updatedAt ?? task.createdAt;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

export function pickRecoverableWizardShotTask(
  tasks: WizardShotTaskRecord[],
  taskId: string | undefined,
  nodeId: string,
): WizardShotTaskRecord | undefined {
  if (taskId?.trim()) {
    const bound = tasks.find((t) => t.id === taskId.trim());
    if (bound && pickWizardShotTaskPreviewUrl(bound)) return bound;
    const polled = pickWizardShotPollTask(tasks, taskId.trim(), nodeId);
    if (polled && pickWizardShotTaskPreviewUrl(polled)) return polled;
  }

  const succeeded = tasks
    .filter(
      (t) =>
        t.nodeId === nodeId &&
        t.status === "SUCCEEDED" &&
        Boolean(pickWizardShotTaskPreviewUrl(t)),
    )
    .sort((a, b) => taskCompletedAtMs(b) - taskCompletedAtMs(a));
  return succeeded[0];
}

export type WizardShotInflightResumeTarget = {
  mediaKind: Pro2WizardShotMediaKind;
  shotIndex: number;
  taskId: string;
};

const ORPHAN_RUNNING_MESSAGE = "任务已中断，请重新生成";

function listWizardShotRecoverTargets(
  scriptHubId: string,
  script: Pro2ProductionScript | undefined,
  drafts: Record<string, Pro2ProductionWizardShotDraft>,
): Array<{ mediaKind: Pro2WizardShotMediaKind; shotIndex: number; draft?: Pro2ProductionWizardShotDraft }> {
  const seen = new Set<string>();
  const out: Array<{
    mediaKind: Pro2WizardShotMediaKind;
    shotIndex: number;
    draft?: Pro2ProductionWizardShotDraft;
  }> = [];

  const push = (
    mediaKind: Pro2WizardShotMediaKind,
    shotIndex: number,
    draft?: Pro2ProductionWizardShotDraft,
  ) => {
    const key = wizardShotDraftKey(mediaKind, shotIndex);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ mediaKind, shotIndex, draft });
  };

  for (const shot of script?.shots ?? []) {
    push("frame", shot.index, drafts[wizardShotDraftKey("frame", shot.index)]);
    push("video", shot.index, drafts[wizardShotDraftKey("video", shot.index)]);
  }

  for (const [key, draft] of Object.entries(drafts)) {
    const parsed = parseWizardShotDraftKey(key);
    if (!parsed) continue;
    push(parsed.mediaKind, parsed.shotIndex, draft);
  }

  return out;
}

function groupTasksByNodeId(
  tasks: WizardShotTaskRecord[],
): Map<string, WizardShotTaskRecord[]> {
  const map = new Map<string, WizardShotTaskRecord[]>();
  for (const task of tasks) {
    const list = map.get(task.nodeId) ?? [];
    list.push(task);
    map.set(task.nodeId, list);
  }
  return map;
}

function restoreWizardShotProgressItem(
  mediaKind: Pro2WizardShotMediaKind,
  shotIndex: number,
  task: WizardShotTaskRecord,
): void {
  upsertWizardAssetProgressItem({
    jobId: wizardShotDraftKey(mediaKind, shotIndex),
    label: `镜 ${shotIndex} · ${WIZARD_SHOT_MEDIA_LABEL[mediaKind]}`,
    kind: mediaKind,
    status: "running",
    startedAt: taskCompletedAtMs(task) || Date.now(),
  });
}

function syncWizardShotInflightFromTasks(
  scriptHubId: string,
  mediaKind: Pro2WizardShotMediaKind,
  shotIndex: number,
  draft: Pro2ProductionWizardShotDraft | undefined,
  nodeTasks: WizardShotTaskRecord[],
): WizardShotInflightResumeTarget | null {
  const inflight = pickWizardShotInflightTask(
    nodeTasks,
    wizardShotRunnerNodeId(scriptHubId, mediaKind, shotIndex),
    draft?.taskId,
  );
  if (!inflight) return null;

  patchProductionWizardShotDraft(scriptHubId, mediaKind, shotIndex, {
    taskId: inflight.id,
    generateStatus: "running",
    failMessage: undefined,
  });
  restoreWizardShotProgressItem(mediaKind, shotIndex, inflight);
  return { mediaKind, shotIndex, taskId: inflight.id };
}

/**
 * 与画布 /tasks 对齐：刷新后从服务端任务恢复 draft + 右下角进度，并返回需续轮询的镜。
 */
export async function recoverWizardShotDraftsFromTasks(
  scriptHubId: string,
  base: string,
  projectId: string,
): Promise<{ recovered: number; inflight: WizardShotInflightResumeTarget[] }> {
  const hub = useCanvasStore
    .getState()
    .nodes.find((n) => n.id === scriptHubId);
  if (!hub || hub.type !== "story-pro2-script-hub") {
    return { recovered: 0, inflight: [] };
  }

  const hubData = hub.data as StoryProScriptHubNodeData;
  const drafts = hubData.productionWizardShotDrafts ?? {};
  const targets = listWizardShotRecoverTargets(
    scriptHubId,
    hubData.productionScript,
    drafts,
  );

  const nodeIds = targets.map(({ mediaKind, shotIndex }) =>
    wizardShotRunnerNodeId(scriptHubId, mediaKind, shotIndex),
  );
  const allTasks = nodeIds.length
    ? ((await listCanvasProjectTasks(base, projectId, nodeIds)) as
        | WizardShotTaskRecord[]
        | null)
    : null;
  const tasksByNode = groupTasksByNodeId(allTasks ?? []);

  let recovered = 0;
  const inflight: WizardShotInflightResumeTarget[] = [];

  for (const { mediaKind, shotIndex, draft } of targets) {
    const nodeId = wizardShotRunnerNodeId(scriptHubId, mediaKind, shotIndex);
    const nodeTasks = tasksByNode.get(nodeId) ?? [];

    const resumeTarget = syncWizardShotInflightFromTasks(
      scriptHubId,
      mediaKind,
      shotIndex,
      draft,
      nodeTasks,
    );
    if (resumeTarget) {
      inflight.push(resumeTarget);
      continue;
    }

    if (draft?.previewUrl?.trim() && draft.generateStatus === "running") {
      patchProductionWizardShotDraft(scriptHubId, mediaKind, shotIndex, {
        generateStatus: "idle",
        failMessage: undefined,
      });
      recovered += 1;
      continue;
    }

    if (draft?.generateStatus === "running" && draft.taskId?.trim()) {
      const taskId = draft.taskId.trim();
      const bound = nodeTasks.find((t) => t.id === taskId);
      if (!bound) {
        patchProductionWizardShotDraft(scriptHubId, mediaKind, shotIndex, {
          generateStatus: "failed",
          failMessage: ORPHAN_RUNNING_MESSAGE,
        });
        recovered += 1;
        continue;
      }
      if (bound.status === "FAILED" || bound.status === "CANCELLED") {
        const result = resolveWizardShotRunResult(bound);
        patchProductionWizardShotDraft(scriptHubId, mediaKind, shotIndex, {
          generateStatus: "failed",
          failMessage: result.ok ? ORPHAN_RUNNING_MESSAGE : result.error,
          taskId: bound.id,
        });
        recovered += 1;
        continue;
      }
      if (bound.status === "SUCCEEDED") {
        const result = resolveWizardShotRunResult(bound);
        if (result.ok) {
          patchProductionWizardShotDraft(scriptHubId, mediaKind, shotIndex, {
            previewUrl: result.previewUrl,
            generateStatus: "idle",
            taskId: result.taskId,
            failMessage: undefined,
          });
          recovered += 1;
        }
        continue;
      }
    }

    if (!nodeTasks.length) continue;

    const task = pickRecoverableWizardShotTask(
      nodeTasks,
      draft?.taskId,
      nodeId,
    );
    if (!task) continue;

    const result = resolveWizardShotRunResult(task);
    if (!result.ok) {
      if (
        task.status === "FAILED" ||
        task.status === "CANCELLED" ||
        task.status === "SUCCEEDED"
      ) {
        patchProductionWizardShotDraft(scriptHubId, mediaKind, shotIndex, {
          generateStatus: "failed",
          failMessage: result.error,
          taskId: task.id,
        });
        recovered += 1;
      }
      continue;
    }

    patchProductionWizardShotDraft(scriptHubId, mediaKind, shotIndex, {
      previewUrl: result.previewUrl,
      generateStatus: "idle",
      taskId: result.taskId,
      failMessage: undefined,
    });
    recovered += 1;
  }

  return { recovered, inflight };
}

export function isWizardShotDraftInflight(
  draft: Pro2ProductionWizardShotDraft | undefined,
): boolean {
  if (!draft) return false;
  if (draft.generateStatus === "running") return true;
  return Boolean(draft.taskId?.trim() && draft.generateStatus !== "failed");
}
