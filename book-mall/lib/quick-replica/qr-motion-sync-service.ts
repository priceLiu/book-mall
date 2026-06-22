import type { GatewayProviderKind } from "@prisma/client";

import { buildKieToolVideoCreateArgs } from "@/lib/canvas/kie-video-tool-builders";
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
import { prisma } from "@/lib/prisma";
import {
  createUserQrTemplate,
  findQrTemplateByLogId,
} from "@/lib/quick-replica/qr-template-service";
import type { QrTemplateJson } from "@/lib/quick-replica/qr-types";
import {
  extractKieResultUrl,
  type KieRecordResponse,
} from "@/lib/story/kie-client";

const CLIENT_SOURCE = "QUICK_REPLICA" as const;
const CLIENT_PAGE = "quick-replica/motion-sync";

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

export async function qrCreateMotionSyncJob(
  userId: string,
  opts: {
    targetImageUrl: string;
    referenceVideoUrl: string;
    prompt?: string;
    modelKey: string;
    mode?: string;
    characterOrientation?: string;
  },
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind }> {
  const auth = await requireGatewayAuth(userId);
  const model = opts.modelKey.trim();
  routeGatewayModel(model);
  const credentialId = pickCredentialForKind(auth.credentials, "KIE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 KIE 凭证");
  }

  const { model: routedModel, input } = buildKieToolVideoCreateArgs({
    model,
    prompt: opts.prompt,
    imageUrls: [opts.targetImageUrl.trim()],
    videoUrls: [opts.referenceVideoUrl.trim()],
    mode: opts.mode,
    characterOrientation: opts.characterOrientation,
  });

  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body: { model: routedModel, input },
    meta: gatewayV1ClientMeta(CLIENT_SOURCE, {
      clientPage: CLIENT_PAGE,
      bookUserId: userId,
    }),
  });

  const existingLog = await prisma.gatewayRequestLog.findUnique({
    where: { id: created.logId },
    select: { inputSummary: true },
  });
  const prevSummary =
    existingLog?.inputSummary && typeof existingLog.inputSummary === "object"
      ? (existingLog.inputSummary as Record<string, unknown>)
      : {};
  await prisma.gatewayRequestLog.update({
    where: { id: created.logId },
    data: {
      inputSummary: {
        ...prevSummary,
        qrMotionSync: {
          targetImageUrl: opts.targetImageUrl.trim(),
          referenceVideoUrl: opts.referenceVideoUrl.trim(),
          prompt: opts.prompt ?? "",
          modelKey: opts.modelKey,
          mode: opts.mode ?? null,
          characterOrientation: opts.characterOrientation ?? null,
        },
      },
    },
  });

  return {
    taskId: created.taskId,
    logId: created.logId,
    providerKind: "KIE",
  };
}

function readMotionSyncSnapshotFromLog(log: {
  inputSummary: unknown;
  model: string;
}): {
  targetImageUrl?: string;
  referenceVideoUrl?: string;
  prompt?: string;
  modelKey?: string;
  mode?: string;
} | null {
  if (!log.inputSummary || typeof log.inputSummary !== "object") return null;
  const root = log.inputSummary as Record<string, unknown>;
  const snap = root.qrMotionSync;
  if (!snap || typeof snap !== "object") return null;
  const s = snap as Record<string, unknown>;
  return {
    targetImageUrl:
      typeof s.targetImageUrl === "string" ? s.targetImageUrl : undefined,
    referenceVideoUrl:
      typeof s.referenceVideoUrl === "string" ? s.referenceVideoUrl : undefined,
    prompt: typeof s.prompt === "string" ? s.prompt : undefined,
    modelKey: typeof s.modelKey === "string" ? s.modelKey : log.model,
    mode: typeof s.mode === "string" ? s.mode : undefined,
  };
}

function extractVideoUrlFromLog(log: {
  resultSummary: unknown;
}): string | null {
  const rs = log.resultSummary;
  if (!rs || typeof rs !== "object") return null;
  const root = rs as Record<string, unknown>;
  if (typeof root.video_url === "string" && root.video_url.trim()) {
    return root.video_url.trim();
  }
  if (typeof root.url === "string" && root.url.trim()) {
    return root.url.trim();
  }
  return null;
}

async function ensureUserTemplateFromLog(args: {
  userId: string;
  logId: string;
  targetImageUrl: string;
  referenceVideoUrl: string;
  prompt: string;
  modelKey: string;
  mode?: string;
  outputUrl: string;
}): Promise<QrTemplateJson> {
  const existing = await findQrTemplateByLogId(args.logId);
  if (existing) return existing;

  const now = new Date().toISOString();
  return createUserQrTemplate({
    userId: args.userId,
    category: "video",
    kind: "motion-sync",
    toolKey: "motion-sync",
    title: `运动同步 · ${new Date().toLocaleString("zh-CN")}`,
    thumbnailUrl: args.targetImageUrl,
    sortOrder: 0,
    gatewayRequestLogId: args.logId,
    reference: {
      slots: {
        targetImage: { url: args.targetImageUrl },
        referenceVideo: { url: args.referenceVideoUrl },
      },
      prompt: { text: args.prompt, locale: "zh" },
      model: {
        role: "VIDEO",
        modelKey: args.modelKey,
        params: args.mode ? { mode: args.mode } : {},
      },
    },
    output: {
      mediaType: "video",
      url: args.outputUrl,
      gatewayRequestLogId: args.logId,
      createdAt: now,
    },
  });
}

export type QrMotionSyncPollResult = {
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  outputUrl?: string;
  error?: string;
  template?: QrTemplateJson;
};

export async function qrPollMotionSyncJob(
  userId: string,
  logId: string,
): Promise<QrMotionSyncPollResult> {
  const log = await prisma.gatewayRequestLog.findFirst({
    where: { id: logId, actorBookUserId: userId },
  });
  if (!log) {
    return { status: "FAILED", error: "任务不存在" };
  }

  const inputSnapshot = readMotionSyncSnapshotFromLog(log) ?? undefined;

  const existingTemplate = await findQrTemplateByLogId(logId);
  if (existingTemplate) {
    return {
      status: "SUCCEEDED",
      outputUrl: existingTemplate.output?.url,
      template: existingTemplate,
    };
  }

  if (log.status === "SUCCEEDED") {
    const outputUrl = extractVideoUrlFromLog(log);
    if (outputUrl && inputSnapshot?.targetImageUrl && inputSnapshot.referenceVideoUrl) {
      const template = await ensureUserTemplateFromLog({
        userId,
        logId,
        targetImageUrl: inputSnapshot.targetImageUrl,
        referenceVideoUrl: inputSnapshot.referenceVideoUrl,
        prompt: inputSnapshot.prompt ?? "",
        modelKey: inputSnapshot.modelKey ?? log.model,
        mode: inputSnapshot.mode,
        outputUrl,
      });
      return { status: "SUCCEEDED", outputUrl, template };
    }
    return {
      status: "SUCCEEDED",
      outputUrl: outputUrl ?? undefined,
    };
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
      await finalizeRequestLog(logId, {
        status: "SUCCEEDED",
        durationMs: log.submittedAt ? Date.now() - log.submittedAt.getTime() : 0,
        resultSummary: { video_url: outputUrl },
        model: log.model,
      });
      if (inputSnapshot?.targetImageUrl && inputSnapshot.referenceVideoUrl) {
        const template = await ensureUserTemplateFromLog({
          userId,
          logId,
          targetImageUrl: inputSnapshot.targetImageUrl,
          referenceVideoUrl: inputSnapshot.referenceVideoUrl,
          prompt: inputSnapshot.prompt ?? "",
          modelKey: inputSnapshot.modelKey ?? log.model,
          mode: inputSnapshot.mode,
          outputUrl,
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

  const status =
    normalized.task_status === "PENDING"
      ? "PENDING"
      : normalized.task_status === "RUNNING"
        ? "RUNNING"
        : "RUNNING";
  return { status };
}
