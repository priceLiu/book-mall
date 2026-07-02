import type { GatewayProviderKind } from "@prisma/client";

import { buildQrTextToVideoCreateArgs } from "@/lib/canvas/kie-video-tool-builders";
import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import {
  gatewayV1ClientMeta,
  gatewayV1CreateTask,
} from "@/lib/gateway/gateway-v1-http-client";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import {
  resolveTextToVideoReferenceImageUrls,
  validateTextToVideoDraft,
} from "@/lib/quick-replica/qr-text-to-video-models";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";
import { prisma } from "@/lib/prisma";

const CLIENT_SOURCE = "QUICK_REPLICA" as const;
const CLIENT_PAGE = "quick-replica/text-to-video";

const PROVIDER_LABEL: Partial<Record<GatewayProviderKind, string>> = {
  KIE: "KIE",
  VOLCENGINE: "火山方舟",
  BAILIAN: "百炼",
  DASHSCOPE: "DashScope",
  DEEPSEEK: "DeepSeek",
  HUNYUAN: "混元",
};

async function requireGatewayAuth(userId: string, modelKey: string) {
  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心关联 Gateway API Key");
  }

  const route = routeGatewayModel(modelKey);
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    throw new GatewayRequiredError(
      `Gateway Key 未绑定 ${PROVIDER_LABEL[route.providerKind] ?? route.providerKind} 凭证`,
    );
  }

  return { auth, providerKind: route.providerKind };
}

export async function qrCreateTextToVideoJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind }> {
  const validationError = validateTextToVideoDraft({
    modelKey: draft.modelKey,
    prompt: draft.prompt,
    sceneImageUrls: draft.sceneImageUrls,
    targetImageUrl: draft.targetImageUrl,
  });
  if (validationError) throw new Error(validationError);

  const modelKey = draft.modelKey.trim();
  const { auth, providerKind } = await requireGatewayAuth(userId, modelKey);

  const imageUrls = resolveTextToVideoReferenceImageUrls({
    sceneImageUrls: draft.sceneImageUrls,
    targetImageUrl: draft.targetImageUrl,
  });

  const { model: routedModel, input } = buildQrTextToVideoCreateArgs({
    modelKey,
    prompt: draft.prompt,
    imageUrls,
    resolution: draft.resolution,
    aspectRatio: draft.aspectRatio,
    duration: draft.duration,
    mode: draft.mode,
    sound: draft.keepOriginalSound,
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
        qrTextToVideo: {
          prompt: draft.prompt,
          modelKey: draft.modelKey,
          referenceImageUrls: imageUrls,
          resolution: draft.resolution ?? null,
          aspectRatio: draft.aspectRatio ?? null,
          duration: draft.duration ?? null,
          mode: draft.mode ?? null,
          draft,
        },
      },
    },
  });

  return {
    taskId: created.taskId,
    logId: created.logId,
    providerKind,
  };
}
