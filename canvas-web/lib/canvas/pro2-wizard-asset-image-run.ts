"use client";

import {
  listCanvasProjectTasks,
  runCanvasNode,
  type CanvasTaskRecord,
} from "@/lib/canvas-api";
import {
  maybeNotifyCanvasCreditsSettled,
  markCanvasNodeGenerationStarted,
} from "@/lib/canvas/canvas-credits-notify";
import { clearCanvasNodeRunSession } from "@/lib/canvas/canvas-run-session";
import { formatCanvasTaskError } from "@/lib/canvas/friendly-task-error";
import { expandWizardMentionsForPrompt } from "@/lib/canvas/pro2-shot-entity-reconcile";
import type { Pro2WizardAssetKind } from "@/lib/canvas/pro2-production-wizard-assets";
import type { Pro2ProductionWizardAssetDraft } from "@/lib/canvas/pro2-production-wizard-assets";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import {
  buildWizardMentionRefCatalog,
  readProductionWizardAssetDraftsFromHub,
  wizardMentionRefUrlsForPrompt,
} from "@/lib/canvas/pro2-wizard-mention-ref-urls";
import { coerceSbv1ImageAspectForModel } from "@/lib/canvas/sbv1-image-models";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";
import { pickPreferredCanvasTask } from "@/lib/canvas/task-pick";
import {
  pickTaskResultMediaUrl,
  taskHasDisplayableResult,
} from "@/lib/canvas/task-media-url";
import type { CanvasNodeRuntime } from "@/lib/canvas/types";
import { useCanvasStore } from "@/lib/canvas/store";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";

/** /tasks 轻量读额外字段（buildGenerationRecordListItem） */
export type WizardAssetTaskRecord = CanvasTaskRecord & {
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
};

const TERMINAL = new Set<CanvasTaskRecord["status"]>([
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export function wizardAssetRunnerNodeId(
  scriptHubId: string,
  kind: Pro2WizardAssetKind,
  assetId: string,
): string {
  return `pro2-wiz-gen-${scriptHubId}-${kind}-${assetId}`;
}

export function pickWizardAssetTaskPreviewUrl(
  task: WizardAssetTaskRecord,
): string | undefined {
  const direct =
    pickTaskResultMediaUrl(task) ??
    task.ossUrl?.trim() ??
    task.ephemeralUrl?.trim() ??
    "";
  if (direct) return direct;
  for (const raw of [task.previewUrl, task.thumbnailUrl]) {
    const url = raw?.trim();
    if (url && /^https?:\/\//i.test(url)) return url;
  }
  return undefined;
}

export function isWizardAssetTaskSettled(task: WizardAssetTaskRecord): boolean {
  if (task.status === "FAILED" || task.status === "CANCELLED") return true;
  if (task.status !== "SUCCEEDED") return false;
  return (
    Boolean(pickWizardAssetTaskPreviewUrl(task)) ||
    taskHasDisplayableResult(task)
  );
}

export function buildWizardAssetImageRunPayload(
  kind: Pro2WizardAssetKind,
  settings: Sbv1ImageNodeData,
  prompt: string,
  refImages: StoryRefImage[],
  script?: Pro2ProductionScript,
  assetDrafts?: Record<string, Pro2ProductionWizardAssetDraft>,
): {
  nodeType: string;
  data: Record<string, unknown>;
  imageInputs: string[];
} {
  const expanded = script
    ? expandWizardMentionsForPrompt(prompt.trim(), script)
    : prompt.trim();
  const nodeType =
    kind === "character" ? "story-pro2-three-view" : "story-pro2-image";
  const modelKey = settings.engine?.modelKey?.trim() ?? "";
  const aspectRatio = modelKey
    ? coerceSbv1ImageAspectForModel(modelKey, settings.aspectRatio ?? "16:9")
    : settings.aspectRatio ?? "16:9";
  const data: Record<string, unknown> = {
    dockInput: expanded,
    engine: settings.engine,
    aspectRatio,
    imageQuality: settings.imageQuality,
    resolution: settings.resolution,
    outputCount: settings.outputCount ?? 1,
  };
  if (kind !== "character") {
    data.pro2MediaRole = kind;
  }
  const catalog = buildWizardMentionRefCatalog(assetDrafts, refImages);
  const imageInputs = wizardMentionRefUrlsForPrompt(prompt, catalog, refImages);
  return { nodeType, data, imageInputs };
}

export function pickWizardAssetPollTask(
  tasks: WizardAssetTaskRecord[],
  taskId: string,
  nodeId: string,
): WizardAssetTaskRecord | undefined {
  const localRuntime: CanvasNodeRuntime = {
    status: "running",
    taskId,
  };
  const preferred = pickPreferredCanvasTask(tasks, {
    nodeId,
    localRuntime,
  }) as WizardAssetTaskRecord | undefined;

  const bound = tasks.find((t) => t.id === taskId);
  if (bound?.status === "FAILED" || bound?.status === "CANCELLED") {
    return bound;
  }
  if (bound && isWizardAssetTaskSettled(bound)) {
    return bound;
  }
  if (preferred?.status === "FAILED" || preferred?.status === "CANCELLED") {
    return preferred;
  }
  if (preferred && isWizardAssetTaskSettled(preferred)) {
    return preferred;
  }
  return undefined;
}

export async function waitPro2WizardAssetImageTask(
  base: string,
  projectId: string,
  taskId: string,
  nodeId: string,
  timeoutMs = 300_000,
): Promise<WizardAssetTaskRecord> {
  return pollTaskUntilDone(base, projectId, taskId, nodeId, timeoutMs);
}

function readWizardAssetDraftsForHub(
  scriptHubId: string,
): Record<string, Pro2ProductionWizardAssetDraft> {
  const hub = useCanvasStore.getState().nodes.find((n) => n.id === scriptHubId);
  if (!hub) return {};
  return readProductionWizardAssetDraftsFromHub(
    hub.data as StoryProScriptHubNodeData,
  );
}

function validateWizardAssetImageRunArgs(
  args: RunPro2WizardAssetImageGenerateArgs,
):
  | { ok: true; nodeId: string; assetDrafts: Record<string, Pro2ProductionWizardAssetDraft> }
  | { ok: false; error: string } {
  if (!args.base?.trim() || !args.projectId?.trim()) {
    return { ok: false, error: "未连接主站，无法出图" };
  }
  if (
    !args.settings.engine?.providerId?.trim() ||
    !args.settings.engine.modelKey?.trim()
  ) {
    return { ok: false, error: "请先选择出图模型" };
  }
  const assetDrafts = readWizardAssetDraftsForHub(args.scriptHubId);
  const catalog = buildWizardMentionRefCatalog(assetDrafts, args.refImages);
  const resolvedRefUrls = wizardMentionRefUrlsForPrompt(
    args.prompt,
    catalog,
    args.refImages,
  );
  const trimmedPrompt = args.prompt.trim();
  const hasRefs = resolvedRefUrls.length > 0;
  if (!trimmedPrompt && !hasRefs) {
    return { ok: false, error: "请填写提示词或添加参考图" };
  }
  return {
    ok: true,
    nodeId: wizardAssetRunnerNodeId(
      args.scriptHubId,
      args.kind,
      args.assetId,
    ),
    assetDrafts,
  };
}

export async function submitPro2WizardAssetImageRun(
  args: RunPro2WizardAssetImageGenerateArgs,
): Promise<
  | { ok: true; task: WizardAssetTaskRecord; nodeId: string }
  | { ok: false; error: string }
> {
  const valid = validateWizardAssetImageRunArgs(args);
  if (!valid.ok) return valid;

  const { nodeType, data, imageInputs } = buildWizardAssetImageRunPayload(
    args.kind,
    args.settings,
    args.prompt,
    args.refImages,
    args.script,
    valid.assetDrafts,
  );

  markCanvasNodeGenerationStarted(valid.nodeId);
  try {
    const r = await runCanvasNode(args.base, args.projectId, valid.nodeId, {
      node: {
        type: nodeType,
        data,
        imageInputs,
        textInputs: [],
      },
      forceFresh: true,
    });
    const task = r.task as WizardAssetTaskRecord;
    maybeNotifyCanvasCreditsSettled(task);
    return { ok: true, task, nodeId: valid.nodeId };
  } catch (e) {
    clearCanvasNodeRunSession(valid.nodeId);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("409") || msg.includes("TASK_ALREADY_INFLIGHT")) {
      return { ok: false, error: "该资产正在出图中，请稍候再试" };
    }
    return { ok: false, error: msg || "出图失败" };
  }
}

export function resolveWizardAssetImageRunResult(
  task: WizardAssetTaskRecord,
): RunPro2WizardAssetImageGenerateResult {
  if (task.status === "FAILED") {
    return {
      ok: false,
      error: formatCanvasTaskError(
        task.failCode,
        task.failMessage,
        task.model,
      ),
    };
  }
  if (task.status === "CANCELLED") {
    return { ok: false, error: "出图已取消" };
  }
  const previewUrl = pickWizardAssetTaskPreviewUrl(task);
  if (!previewUrl) {
    return { ok: false, error: "出图完成但未返回图片 URL" };
  }
  return { ok: true, previewUrl, taskId: task.id };
}

async function pollTaskUntilDone(
  base: string,
  projectId: string,
  taskId: string,
  nodeId: string,
  timeoutMs = 300_000,
): Promise<WizardAssetTaskRecord> {
  const start = Date.now();
  let stalePolls = 0;
  while (Date.now() - start < timeoutMs) {
    const tasks = (await listCanvasProjectTasks(base, projectId, [
      nodeId,
    ])) as WizardAssetTaskRecord[] | null;
    if (tasks === null) {
      stalePolls += 1;
      if (stalePolls >= 6) {
        throw new Error("无法获取任务状态，请稍后重试");
      }
    } else {
      stalePolls = 0;
      const pick = pickWizardAssetPollTask(tasks, taskId, nodeId);
      if (pick) {
        maybeNotifyCanvasCreditsSettled(pick);
        return pick;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("出图超时，请稍后在任务列表查看是否已完成");
}

export type RunPro2WizardAssetImageGenerateArgs = {
  base: string;
  projectId: string;
  scriptHubId: string;
  kind: Pro2WizardAssetKind;
  assetId: string;
  settings: Sbv1ImageNodeData;
  prompt: string;
  refImages: StoryRefImage[];
  script?: Pro2ProductionScript;
};

export type RunPro2WizardAssetImageGenerateResult =
  | { ok: true; previewUrl: string; taskId: string }
  | { ok: false; error: string };

/** 向导资产卡 · Gateway 出图（同步等待，测试/脚本用） */
export async function runPro2WizardAssetImageGenerate(
  args: RunPro2WizardAssetImageGenerateArgs,
): Promise<RunPro2WizardAssetImageGenerateResult> {
  const valid = validateWizardAssetImageRunArgs(args);
  if (!valid.ok) return valid;

  const submitted = await submitPro2WizardAssetImageRun(args);
  if (!submitted.ok) return submitted;

  const { task: initial, nodeId } = submitted;
  try {
    let task = initial;
    if (!isWizardAssetTaskSettled(task)) {
      if (!TERMINAL.has(task.status) || task.status === "SUCCEEDED") {
        task = await pollTaskUntilDone(
          args.base,
          args.projectId,
          task.id,
          nodeId,
        );
      }
    }
    return resolveWizardAssetImageRunResult(task);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("409") || msg.includes("TASK_ALREADY_INFLIGHT")) {
      try {
        const tasks = (await listCanvasProjectTasks(
          args.base,
          args.projectId,
          [nodeId],
        )) as WizardAssetTaskRecord[] | null;
        const scoped = (tasks ?? []).filter((t) => t.nodeId === nodeId);
        const pick = pickWizardAssetPollTask(
          scoped,
          scoped[0]?.id ?? "",
          nodeId,
        );
        if (pick && isWizardAssetTaskSettled(pick)) {
          return resolveWizardAssetImageRunResult(pick);
        }
      } catch {
        /* fall through */
      }
      return { ok: false, error: "该资产正在出图中，请稍候再试" };
    }
    return { ok: false, error: msg || "出图失败" };
  } finally {
    clearCanvasNodeRunSession(nodeId);
  }
}
