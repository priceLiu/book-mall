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
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import type { Pro2ProductionWizardAssetDraft } from "@/lib/canvas/pro2-production-wizard-assets";
import {
  buildWizardMentionRefCatalog,
  mergeWizardMentionRefImages,
  wizardMentionRefUrlsForPrompt,
} from "@/lib/canvas/pro2-wizard-mention-ref-urls";
import {
  shotRowKey,
  type Pro2WizardShotMediaKind,
} from "@/lib/canvas/pro2-production-wizard-shot-drafts";
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
import { readProductionWizardAssetDraftsFromHub } from "@/lib/canvas/pro2-wizard-mention-ref-urls";
import { resolveDashscopeVideoModelForRefLinks } from "@/lib/canvas/sbv1-video-model-reference";

const DASHSCOPE_T2V_TO_I2V: Record<string, string> = {
  "happyhorse-1.0-t2v": "happyhorse-1.0-i2v",
  "happyhorse-1.1-t2v": "happyhorse-1.1-i2v",
};

/** 向导分镜视频 · 按静帧 + @ 参考图解析应使用的 Gateway 模型 */
export function resolveWizardShotVideoModelKey(args: {
  modelKey: string;
  framePreviewUrl: string;
  prompt: string;
  refImages: StoryRefImage[];
  assetDrafts?: Record<string, Pro2ProductionWizardAssetDraft>;
}): string {
  const frameUrl = args.framePreviewUrl.trim();
  if (!/^https?:\/\//.test(frameUrl)) return args.modelKey.trim();

  const catalog = buildWizardMentionRefCatalog(args.assetDrafts, args.refImages);
  const mentionRefUrls = wizardMentionRefUrlsForPrompt(
    args.prompt,
    catalog,
    args.refImages,
  );
  const extraRefs = mentionRefUrls.filter((u) => u !== frameUrl);
  const modelKey = args.modelKey.trim();

  if (extraRefs.length > 0) {
    return (
      resolveDashscopeVideoModelForRefLinks(modelKey, 1 + extraRefs.length) ??
      modelKey
    );
  }

  return DASHSCOPE_T2V_TO_I2V[modelKey] ?? modelKey;
}

export type WizardShotTaskRecord = CanvasTaskRecord & {
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
};

const TERMINAL = new Set<CanvasTaskRecord["status"]>([
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

const WIZARD_SHOT_INFLIGHT = new Set<CanvasTaskRecord["status"]>([
  "QUEUED",
  "DISPATCHING",
  "PENDING",
  "SUBMITTED",
]);

/** 无 vendor / Gateway 进展且停留过久 → 视为僵尸任务（刷新后勿无限 poll） */
export const WIZARD_SHOT_STALE_INFLIGHT_MS = 120_000;

function wizardShotTaskAgeMs(task: WizardShotTaskRecord): number {
  const raw = task.updatedAt ?? task.createdAt;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? Date.now() - ms : 0;
}

function wizardShotTaskHasVendorProgress(task: WizardShotTaskRecord): boolean {
  return Boolean(task.kieTaskId?.trim()) || Boolean(task.submittedAt?.trim());
}

export function isWizardShotTaskStaleInflight(
  task: WizardShotTaskRecord,
  staleMs = WIZARD_SHOT_STALE_INFLIGHT_MS,
): boolean {
  if (!WIZARD_SHOT_INFLIGHT.has(task.status)) return false;
  if (wizardShotTaskHasVendorProgress(task)) return false;
  return wizardShotTaskAgeMs(task) >= staleMs;
}

export function wizardShotRunnerNodeId(
  scriptHubId: string,
  mediaKind: Pro2WizardShotMediaKind,
  shotIndex: number,
): string {
  return `pro2-wiz-shot-${scriptHubId}-${mediaKind}-${shotIndex}`;
}

const WIZARD_SHOT_TASK_INFLIGHT = new Set<CanvasTaskRecord["status"]>([
  "QUEUED",
  "DISPATCHING",
  "PENDING",
  "SUBMITTED",
]);

export function isWizardShotTaskInflight(
  status: CanvasTaskRecord["status"],
): boolean {
  return WIZARD_SHOT_TASK_INFLIGHT.has(status);
}

/** 从虚拟 runner nodeId 反解 scriptHub / 镜号（与 wizardShotRunnerNodeId 对称） */
export function parseWizardShotRunnerNodeId(nodeId: string): {
  scriptHubId: string;
  mediaKind: Pro2WizardShotMediaKind;
  shotIndex: number;
} | null {
  const prefix = "pro2-wiz-shot-";
  if (!nodeId.startsWith(prefix)) return null;
  const rest = nodeId.slice(prefix.length);
  const parts = rest.split("-");
  if (parts.length < 3) return null;
  const shotIndex = Number.parseInt(parts[parts.length - 1] ?? "", 10);
  const mediaKind = parts[parts.length - 2] as Pro2WizardShotMediaKind;
  if (mediaKind !== "frame" && mediaKind !== "video") return null;
  if (!Number.isFinite(shotIndex) || shotIndex <= 0) return null;
  const scriptHubId = parts.slice(0, -2).join("-");
  if (!scriptHubId) return null;
  return { scriptHubId, mediaKind, shotIndex };
}

export function pickWizardShotInflightTask(
  tasks: WizardShotTaskRecord[],
  nodeId: string,
  preferredTaskId?: string,
): WizardShotTaskRecord | undefined {
  if (preferredTaskId?.trim()) {
    const bound = tasks.find((t) => t.id === preferredTaskId.trim());
    if (bound && isWizardShotTaskInflight(bound.status)) return bound;
  }
  return tasks
    .filter((t) => t.nodeId === nodeId && isWizardShotTaskInflight(t.status))
    .sort(
      (a, b) =>
        Date.parse(b.updatedAt ?? b.createdAt) -
        Date.parse(a.updatedAt ?? a.createdAt),
    )[0];
}

export function pickWizardShotTaskPreviewUrl(
  task: WizardShotTaskRecord,
): string | undefined {
  const direct = pickTaskResultMediaUrl(task);
  if (direct) return direct;

  for (const raw of [
    task.previewUrl,
    task.ossUrl,
    task.ephemeralUrl,
    task.posterUrl,
    task.thumbnailUrl,
  ]) {
    const url = raw?.trim();
    if (url && /^https?:\/\//i.test(url)) return url;
  }
  return undefined;
}

export function isWizardShotTaskSettled(task: WizardShotTaskRecord): boolean {
  if (task.status === "FAILED" || task.status === "CANCELLED") return true;
  if (task.status !== "SUCCEEDED") return false;
  return (
    Boolean(pickWizardShotTaskPreviewUrl(task)) ||
    taskHasDisplayableResult(task)
  );
}

export function buildWizardShotFrameRunPayload(
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
  const modelKey = settings.engine?.modelKey?.trim() ?? "";
  const aspectRatio = modelKey
    ? coerceSbv1ImageAspectForModel(modelKey, settings.aspectRatio ?? "16:9")
    : settings.aspectRatio ?? "16:9";
  const catalog = buildWizardMentionRefCatalog(assetDrafts, refImages);
  const imageInputs = wizardMentionRefUrlsForPrompt(prompt, catalog, refImages);
  return {
    nodeType: "story-pro2-image",
    data: {
      dockInput: expanded,
      engine: settings.engine,
      aspectRatio,
      imageQuality: settings.imageQuality,
      resolution: settings.resolution,
      outputCount: settings.outputCount ?? 1,
    },
    imageInputs,
  };
}

export function buildWizardShotVideoRunPayload(args: {
  shotIndex: number;
  prompt: string;
  refImages: StoryRefImage[];
  framePreviewUrl: string;
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  dialogue?: string;
  script?: Pro2ProductionScript;
  assetDrafts?: Record<string, Pro2ProductionWizardAssetDraft>;
}): {
  nodeType: string;
  data: Record<string, unknown>;
  imageInputs: string[];
  mediaKind: "video";
  rowKey: string;
} {
  const expanded = args.script
    ? expandWizardMentionsForPrompt(args.prompt.trim(), args.script)
    : args.prompt.trim();
  const rowKey = shotRowKey(args.shotIndex);
  const frameUrl = args.framePreviewUrl.trim();
  const catalog = buildWizardMentionRefCatalog(args.assetDrafts, args.refImages);
  const mergedRefImages = mergeWizardMentionRefImages(
    args.prompt,
    catalog,
    args.refImages,
  );
  const mentionRefUrls = wizardMentionRefUrlsForPrompt(
    args.prompt,
    catalog,
    args.refImages,
  );
  const extraRefs = mentionRefUrls.filter((u) => u !== frameUrl);
  return {
    nodeType: "story-pro2-video",
    data: {
      batchVideo: {
        providerId: args.providerId,
        modelKey: args.modelKey,
        params: args.params,
      },
      rows: [
        {
          key: rowKey,
          frameIndex: args.shotIndex,
          dialogue: args.dialogue?.trim() ?? "",
          videoPrompt: expanded,
          frameImageUrl: frameUrl,
          frameApprovedAt: new Date().toISOString(),
          refImages: mergedRefImages,
        },
      ],
    },
    imageInputs: [frameUrl, ...extraRefs].slice(0, 8),
    mediaKind: "video",
    rowKey,
  };
}

export function pickWizardShotPollTask(
  tasks: WizardShotTaskRecord[],
  taskId: string,
  nodeId: string,
): WizardShotTaskRecord | undefined {
  const localRuntime: CanvasNodeRuntime = {
    status: "running",
    taskId,
  };
  const preferred = pickPreferredCanvasTask(tasks, {
    nodeId,
    localRuntime,
  }) as WizardShotTaskRecord | undefined;

  const bound = tasks.find((t) => t.id === taskId);
  if (bound?.status === "FAILED" || bound?.status === "CANCELLED") {
    return bound;
  }
  if (bound && isWizardShotTaskSettled(bound)) {
    return bound;
  }
  if (preferred?.status === "FAILED" || preferred?.status === "CANCELLED") {
    return preferred;
  }
  if (preferred && isWizardShotTaskSettled(preferred)) {
    return preferred;
  }
  return undefined;
}

export async function waitPro2WizardShotTask(
  base: string,
  projectId: string,
  taskId: string,
  nodeId: string,
  timeoutMs = 600_000,
): Promise<WizardShotTaskRecord> {
  return pollTaskUntilDone(base, projectId, taskId, nodeId, timeoutMs);
}

export type RunPro2WizardShotGenerateArgs = {
  base: string;
  projectId: string;
  scriptHubId: string;
  mediaKind: Pro2WizardShotMediaKind;
  shotIndex: number;
  prompt: string;
  refImages: StoryRefImage[];
  script?: Pro2ProductionScript;
  /** frame 出图设置 */
  frameSettings?: Sbv1ImageNodeData;
  /** video 引擎 */
  videoEngine?: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  };
  framePreviewUrl?: string;
  dialogue?: string;
};

function readWizardAssetDraftsForHub(
  scriptHubId: string,
): Record<string, Pro2ProductionWizardAssetDraft> {
  const hub = useCanvasStore.getState().nodes.find((n) => n.id === scriptHubId);
  if (!hub) return {};
  return readProductionWizardAssetDraftsFromHub(
    hub.data as StoryProScriptHubNodeData,
  );
}

function validateWizardShotRunArgs(
  args: RunPro2WizardShotGenerateArgs,
):
  | { ok: true; nodeId: string; assetDrafts: Record<string, Pro2ProductionWizardAssetDraft> }
  | { ok: false; error: string } {
  if (!args.base?.trim() || !args.projectId?.trim()) {
    return { ok: false, error: "未连接主站，无法生成" };
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
  if (!trimmedPrompt && !hasRefs && args.mediaKind === "frame") {
    return { ok: false, error: "请填写提示词或添加参考图" };
  }
  if (args.mediaKind === "frame") {
    if (
      !args.frameSettings?.engine?.providerId?.trim() ||
      !args.frameSettings.engine.modelKey?.trim()
    ) {
      return { ok: false, error: "请先选择分镜图模型" };
    }
  } else {
    if (!args.videoEngine?.providerId?.trim() || !args.videoEngine.modelKey?.trim()) {
      return { ok: false, error: "请先选择分镜视频模型" };
    }
    const frameUrl = args.framePreviewUrl?.trim();
    if (!frameUrl || !/^https?:\/\//i.test(frameUrl)) {
      return { ok: false, error: "请先生成该镜的分镜图" };
    }
    if (!trimmedPrompt) {
      return { ok: false, error: "请填写视频提示词" };
    }
  }
  return {
    ok: true,
    nodeId: wizardShotRunnerNodeId(
      args.scriptHubId,
      args.mediaKind,
      args.shotIndex,
    ),
    assetDrafts,
  };
}

export async function submitPro2WizardShotRun(
  args: RunPro2WizardShotGenerateArgs,
): Promise<
  | { ok: true; task: WizardShotTaskRecord; nodeId: string }
  | { ok: false; error: string }
> {
  const valid = validateWizardShotRunArgs(args);
  if (!valid.ok) return valid;

  let payload:
    | ReturnType<typeof buildWizardShotFrameRunPayload>
    | ReturnType<typeof buildWizardShotVideoRunPayload>;
  if (args.mediaKind === "frame") {
    payload = buildWizardShotFrameRunPayload(
      args.frameSettings!,
      args.prompt,
      args.refImages,
      args.script,
      valid.assetDrafts,
    );
  } else {
    const resolvedModelKey = resolveWizardShotVideoModelKey({
      modelKey: args.videoEngine!.modelKey,
      framePreviewUrl: args.framePreviewUrl!,
      prompt: args.prompt,
      refImages: args.refImages,
      assetDrafts: valid.assetDrafts,
    });
    payload = buildWizardShotVideoRunPayload({
      shotIndex: args.shotIndex,
      prompt: args.prompt,
      refImages: args.refImages,
      framePreviewUrl: args.framePreviewUrl!,
      providerId: args.videoEngine!.providerId,
      modelKey: resolvedModelKey,
      params: args.videoEngine!.params ?? {},
      dialogue: args.dialogue,
      script: args.script,
      assetDrafts: valid.assetDrafts,
    });
  }

  markCanvasNodeGenerationStarted(valid.nodeId);
  try {
    const runBody: Parameters<typeof runCanvasNode>[3] = {
      node: {
        type: payload.nodeType,
        data: payload.data,
        imageInputs: payload.imageInputs,
        textInputs: [],
      },
      forceFresh: true,
    };
    if (args.mediaKind === "video" && "rowKey" in payload) {
      runBody.rowKey = payload.rowKey;
      runBody.mediaKind = "video";
      /** 向导内分镜视频 · 跳过画布风格定稿门禁（与 Step3 虚拟节点一致） */
      runBody.styleFinalized = true;
    }
    const r = await runCanvasNode(args.base, args.projectId, valid.nodeId, runBody);
    const task = r.task as WizardShotTaskRecord;
    maybeNotifyCanvasCreditsSettled(task);
    return { ok: true, task, nodeId: valid.nodeId };
  } catch (e) {
    clearCanvasNodeRunSession(valid.nodeId);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("409") || msg.includes("TASK_ALREADY_INFLIGHT")) {
      return { ok: false, error: "该镜正在生成中，请稍候再试" };
    }
    return { ok: false, error: msg || "生成失败" };
  }
}

export function resolveWizardShotRunResult(
  task: WizardShotTaskRecord,
): { ok: true; previewUrl: string; taskId: string } | { ok: false; error: string } {
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
    return { ok: false, error: "生成已取消" };
  }
  const previewUrl = pickWizardShotTaskPreviewUrl(task);
  if (!previewUrl) {
    return { ok: false, error: "生成完成但未返回媒体 URL" };
  }
  return { ok: true, previewUrl, taskId: task.id };
}

async function pollTaskUntilDone(
  base: string,
  projectId: string,
  taskId: string,
  nodeId: string,
  timeoutMs: number,
): Promise<WizardShotTaskRecord> {
  const start = Date.now();
  let stalePolls = 0;
  let missingTaskPolls = 0;
  while (Date.now() - start < timeoutMs) {
    const tasks = (await listCanvasProjectTasks(base, projectId, [
      nodeId,
    ])) as WizardShotTaskRecord[] | null;
    if (tasks === null) {
      stalePolls += 1;
      if (stalePolls >= 6) {
        throw new Error("无法获取任务状态，请稍后重试");
      }
    } else {
      stalePolls = 0;
      const bound = tasks.find((t) => t.id === taskId);
      if (!bound) {
        missingTaskPolls += 1;
        if (missingTaskPolls >= 3) {
          throw new Error("任务已失效，请重新生成");
        }
      } else {
        missingTaskPolls = 0;
        if (isWizardShotTaskStaleInflight(bound)) {
          throw new Error("任务长时间未推进，请重新生成");
        }
      }
      const pick = pickWizardShotPollTask(tasks, taskId, nodeId);
      if (pick) {
        maybeNotifyCanvasCreditsSettled(pick);
        return pick;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("生成超时，请稍后在任务列表查看是否已完成");
}
