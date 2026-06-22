import type { GatewayProviderKind } from "@prisma/client";

import { buildKieToolVideoCreateArgs } from "@/lib/canvas/kie-video-tool-builders";
import { buildKieImageCreateArgs } from "@/lib/canvas/providers/kie";
import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import {
  gatewayV1ClientMeta,
  gatewayV1CreateTask,
  gatewayV1RecordInfo,
} from "@/lib/gateway/gateway-v1-http-client";
import {
  normalizeKieRecordForToolLab,
  type ToolLabKiePollOutput,
} from "@/lib/gateway/kie-tool-gateway";
import { finalizeRequestLog, pickCredentialForKind } from "@/lib/gateway/proxy-common";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { getKindDef } from "@/lib/quick-replica/qr-kinds";
import {
  qrCreateMotionSyncJob,
  qrPollMotionSyncJob,
  type QrMotionSyncPollResult,
} from "@/lib/quick-replica/qr-motion-sync-service";
import {
  createUserQrTemplate,
  findQrTemplateByLogId,
} from "@/lib/quick-replica/qr-template-service";
import type { QrCategory, QrTemplateJson, QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";
import { extractKieResultUrl, type KieRecordResponse } from "@/lib/story/kie-client";
import { prisma } from "@/lib/prisma";

const CLIENT_SOURCE = "QUICK_REPLICA" as const;

export type QrGeneratePollResult = QrMotionSyncPollResult;

async function requireGatewayAuth(userId: string) {
  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心关联 Gateway API Key");
  }
  if (auth.credentials.length === 0) {
    throw new GatewayRequiredError("Gateway API Key 未绑定厂商凭证");
  }
  return auth;
}

function clientPageForKind(kind: string): string {
  return `quick-replica/${kind}`;
}

function mediaTypeForCategory(category: QrCategory): "image" | "video" | "audio" {
  if (category === "audio") return "audio";
  if (category === "image") return "image";
  return "video";
}

function buildGenericCreateBody(draft: QrWorkspaceDraft): {
  model: string;
  input: Record<string, unknown>;
} {
  const modelKey = draft.modelKey.trim();
  routeGatewayModel(modelKey);

  const imageUrls = [
    draft.targetImageUrl,
    ...draft.sceneImageUrls,
  ].filter((u) => u.trim());

  if (draft.kind === "motion-sync" || draft.toolKey === "motion-sync") {
    return buildKieToolVideoCreateArgs({
      model: modelKey,
      prompt: draft.prompt,
      imageUrls: draft.targetImageUrl ? [draft.targetImageUrl] : undefined,
      videoUrls: draft.referenceVideoUrl ? [draft.referenceVideoUrl] : undefined,
      mode: draft.mode,
      characterOrientation: draft.characterOrientation,
    });
  }

  const kindDef = getKindDef(draft.kind);
  const isVideo =
    draft.category === "video" ||
    draft.category === "character" ||
    draft.category === "world" ||
    kindDef?.toolKey?.includes("video") ||
    draft.kind.includes("video");

  if (isVideo && draft.category !== "image") {
    if (imageUrls.length > 0 || draft.referenceVideoUrl) {
      return buildKieToolVideoCreateArgs({
        model: modelKey,
        prompt: draft.prompt,
        imageUrls: imageUrls.length ? imageUrls : undefined,
        videoUrls: draft.referenceVideoUrl ? [draft.referenceVideoUrl] : undefined,
        videoUrl: draft.referenceVideoUrl || undefined,
        mode: draft.mode,
      });
    }
    return buildKieToolVideoCreateArgs({
      model: modelKey,
      prompt: draft.prompt,
      mode: draft.mode,
    });
  }

  return buildKieImageCreateArgs({
    modelKey,
    prompt: draft.prompt,
    imageUrls: imageUrls.length ? imageUrls : undefined,
    params: draft.mode ? { mode: draft.mode } : {},
  });
}

async function persistLogSnapshot(logId: string, draft: QrWorkspaceDraft) {
  const existingLog = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: { inputSummary: true },
  });
  const prevSummary =
    existingLog?.inputSummary && typeof existingLog.inputSummary === "object"
      ? (existingLog.inputSummary as Record<string, unknown>)
      : {};
  await prisma.gatewayRequestLog.update({
    where: { id: logId },
    data: {
      inputSummary: {
        ...prevSummary,
        qrGenerate: {
          category: draft.category,
          kind: draft.kind,
          toolKey: draft.toolKey ?? null,
          draft,
        },
      },
    },
  });
}

export async function qrCreateGenerateJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind | string }> {
  if (draft.kind === "motion-sync" || draft.toolKey === "motion-sync") {
    if (!draft.targetImageUrl.trim() || !draft.referenceVideoUrl.trim()) {
      throw new Error("运动同步需要目标图与参考视频");
    }
    const job = await qrCreateMotionSyncJob(userId, {
      targetImageUrl: draft.targetImageUrl,
      referenceVideoUrl: draft.referenceVideoUrl,
      prompt: draft.prompt,
      modelKey: draft.modelKey,
      mode: draft.mode,
      characterOrientation: draft.characterOrientation,
    });
    return job;
  }

  const auth = await requireGatewayAuth(userId);
  const { model, input } = buildGenericCreateBody(draft);
  const providerKind: GatewayProviderKind =
    draft.category === "image" ? "KIE" : "KIE";
  pickCredentialForKind(auth.credentials, providerKind);

  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body: { model, input },
    meta: gatewayV1ClientMeta(CLIENT_SOURCE, {
      clientPage: clientPageForKind(draft.kind),
      bookUserId: userId,
    }),
  });

  await persistLogSnapshot(created.logId, draft);
  return {
    logId: created.logId,
    taskId: created.taskId,
    providerKind: created.providerKind,
  };
}

function readGenerateDraftFromLog(log: {
  inputSummary: unknown;
  model: string;
}): QrWorkspaceDraft | null {
  if (!log.inputSummary || typeof log.inputSummary !== "object") return null;
  const root = log.inputSummary as Record<string, unknown>;
  const snap = root.qrGenerate ?? root.qrMotionSync;
  if (!snap || typeof snap !== "object") return null;
  const s = snap as Record<string, unknown>;
  if (s.draft && typeof s.draft === "object") {
    return s.draft as QrWorkspaceDraft;
  }
  if (typeof s.targetImageUrl === "string") {
    return {
      category: "video",
      kind: "motion-sync",
      toolKey: "motion-sync",
      targetImageUrl: String(s.targetImageUrl ?? ""),
      referenceVideoUrl: String(s.referenceVideoUrl ?? ""),
      referenceAudioUrl: "",
      sceneImageUrls: [],
      prompt: String(s.prompt ?? ""),
      modelKey: String(s.modelKey ?? log.model),
      mode: typeof s.mode === "string" ? s.mode : undefined,
    };
  }
  return null;
}

function extractOutputUrl(log: {
  resultSummary: unknown;
  requestKind: string;
}): { url: string; mediaType: "image" | "video" | "audio" } | null {
  const rs = log.resultSummary;
  if (!rs || typeof rs !== "object") return null;
  const root = rs as Record<string, unknown>;
  if (typeof root.video_url === "string" && root.video_url.trim()) {
    return { url: root.video_url.trim(), mediaType: "video" };
  }
  if (typeof root.url === "string" && root.url.trim()) {
    const mediaType =
      log.requestKind === "IMAGE" || log.requestKind === "TRYON" ? "image" : "video";
    return { url: root.url.trim(), mediaType };
  }
  if (typeof root.image_url === "string" && root.image_url.trim()) {
    return { url: root.image_url.trim(), mediaType: "image" };
  }
  return null;
}

async function ensureUserTemplateFromLog(args: {
  userId: string;
  logId: string;
  draft: QrWorkspaceDraft;
  outputUrl: string;
  mediaType: "image" | "video" | "audio";
}): Promise<QrTemplateJson> {
  const existing = await findQrTemplateByLogId(args.logId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const title =
    args.draft.title?.trim() ||
    `${getKindDef(args.draft.kind)?.label ?? args.draft.kind} · ${new Date().toLocaleString("zh-CN")}`;

  return createUserQrTemplate({
    userId: args.userId,
    category: args.draft.category,
    kind: args.draft.kind,
    toolKey: args.draft.toolKey,
    title,
    thumbnailUrl:
      args.mediaType === "image"
        ? args.outputUrl
        : args.draft.targetImageUrl || args.outputUrl,
    sortOrder: 0,
    gatewayRequestLogId: args.logId,
    reference: {
      slots: {
        ...(args.draft.targetImageUrl
          ? { targetImage: { url: args.draft.targetImageUrl } }
          : {}),
        ...(args.draft.referenceVideoUrl
          ? { referenceVideo: { url: args.draft.referenceVideoUrl } }
          : {}),
        ...(args.draft.referenceAudioUrl
          ? { referenceAudio: { url: args.draft.referenceAudioUrl } }
          : {}),
        ...(args.draft.sceneImageUrls.length
          ? {
              sceneImages: args.draft.sceneImageUrls.map((url) => ({ url })),
            }
          : {}),
      },
      prompt: { text: args.draft.prompt, locale: "zh" },
      model: {
        role:
          args.mediaType === "image"
            ? "IMAGE"
            : args.mediaType === "audio"
              ? "AUDIO"
              : "VIDEO",
        modelKey: args.draft.modelKey,
        params: args.draft.mode ? { mode: args.draft.mode } : {},
      },
    },
    output: {
      mediaType: args.mediaType,
      url: args.outputUrl,
      gatewayRequestLogId: args.logId,
      createdAt: now,
    },
  });
}

export async function qrPollGenerateJob(
  userId: string,
  logId: string,
): Promise<QrGeneratePollResult> {
  const log = await prisma.gatewayRequestLog.findFirst({
    where: { id: logId, actorBookUserId: userId },
  });
  if (!log) return { status: "FAILED", error: "任务不存在" };

  const draft = readGenerateDraftFromLog(log);
  const isMotionSync =
    draft?.kind === "motion-sync" ||
    draft?.toolKey === "motion-sync" ||
    Boolean(
      log.inputSummary &&
        typeof log.inputSummary === "object" &&
        (log.inputSummary as Record<string, unknown>).qrMotionSync,
    );
  if (isMotionSync) {
    return qrPollMotionSyncJob(userId, logId);
  }

  const existingTemplate = await findQrTemplateByLogId(logId);
  if (existingTemplate) {
    return {
      status: "SUCCEEDED",
      outputUrl: existingTemplate.output?.url,
      template: existingTemplate,
    };
  }

  if (log.status === "SUCCEEDED") {
    const out = extractOutputUrl(log);
    if (out && draft) {
      const template = await ensureUserTemplateFromLog({
        userId,
        logId,
        draft,
        outputUrl: out.url,
        mediaType: out.mediaType,
      });
      return { status: "SUCCEEDED", outputUrl: out.url, template };
    }
    return { status: "SUCCEEDED", outputUrl: out?.url };
  }

  if (log.status === "FAILED") {
    return { status: "FAILED", error: log.failMessage ?? "生成失败" };
  }

  if (!log.externalTaskId) {
    return { status: "PENDING" };
  }

  const auth = await requireGatewayAuth(userId);
  const polled = await gatewayV1RecordInfo({
    apiKeyId: auth.id,
    taskId: log.externalTaskId,
    meta: gatewayV1ClientMeta(CLIENT_SOURCE, { bookUserId: userId }),
  });

  const record = polled.data as KieRecordResponse;
  const normalized: ToolLabKiePollOutput = normalizeKieRecordForToolLab(record);

  if (normalized.task_status === "SUCCEEDED") {
    const outputUrl =
      normalized.video_url ?? extractKieResultUrl(record) ?? undefined;
    if (outputUrl) {
      const mediaType = log.requestKind === "IMAGE" ? "image" : "video";
      await finalizeRequestLog(logId, {
        status: "SUCCEEDED",
        durationMs: log.submittedAt ? Date.now() - log.submittedAt.getTime() : 0,
        resultSummary:
          mediaType === "image"
            ? { url: outputUrl, image_url: outputUrl }
            : { video_url: outputUrl },
        model: log.model,
      });
      if (draft) {
        const template = await ensureUserTemplateFromLog({
          userId,
          logId,
          draft,
          outputUrl,
          mediaType,
        });
        return { status: "SUCCEEDED", outputUrl, template };
      }
      return { status: "SUCCEEDED", outputUrl };
    }
    return { status: "RUNNING" };
  }

  if (normalized.task_status === "FAILED") {
    await finalizeRequestLog(logId, {
      status: "FAILED",
      durationMs: log.submittedAt ? Date.now() - log.submittedAt.getTime() : 0,
      failMessage: normalized.message ?? "生成失败",
      failCode: normalized.code,
      model: log.model,
    });
    return { status: "FAILED", error: normalized.message ?? "生成失败" };
  }

  return {
    status:
      normalized.task_status === "PENDING"
        ? "PENDING"
        : normalized.task_status === "RUNNING"
          ? "RUNNING"
          : "RUNNING",
  };
}

export function resolveGenerateHandlerKind(kind: string): string {
  if (kind === "motion-sync" || kind === "lip-sync") return "motion-sync";
  return kind;
}
