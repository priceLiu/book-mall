import type { GatewayProviderKind } from "@prisma/client";

import { buildQrTextToImageCreateArgs } from "@/lib/canvas/qr-image-builders";
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
  resolveQrTextToImageGatewayModelKey,
  resolveTextToImageReferenceImageUrls,
  validateTextToImageDraft,
} from "@/lib/quick-replica/qr-text-to-image-models";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";
import { prisma } from "@/lib/prisma";

const CLIENT_SOURCE = "QUICK_REPLICA" as const;
const CLIENT_PAGE = "quick-replica/create-image";

export async function qrCreateTextToImageJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind }> {
  const validationError = validateTextToImageDraft({
    modelKey: draft.modelKey,
    prompt: draft.prompt,
    sceneImageUrls: draft.sceneImageUrls,
    targetImageUrl: draft.targetImageUrl,
  });
  if (validationError) throw new Error(validationError);

  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心关联 Gateway API Key");
  }

  const gatewayModelKey = resolveQrTextToImageGatewayModelKey(draft.modelKey);
  const route = routeGatewayModel(gatewayModelKey);
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    throw new GatewayRequiredError(`Gateway Key 未绑定 ${route.providerKind} 凭证`);
  }

  const imageUrls = resolveTextToImageReferenceImageUrls({
    sceneImageUrls: draft.sceneImageUrls,
    targetImageUrl: draft.targetImageUrl,
  });

  const { model: routedModel, input } = buildQrTextToImageCreateArgs({
    modelKey: draft.modelKey,
    prompt: draft.prompt,
    imageUrls,
    aspectRatio: draft.aspectRatio,
    resolution: draft.resolution,
    mode: draft.mode,
    outputFormat: draft.outputFormat,
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
        qrTextToImage: {
          prompt: draft.prompt,
          modelKey: draft.modelKey,
          referenceImageUrls: imageUrls,
          aspectRatio: draft.aspectRatio ?? null,
          resolution: draft.resolution ?? null,
          mode: draft.mode ?? null,
          outputFormat: draft.outputFormat ?? null,
          draft,
        },
      },
    },
  });

  return {
    taskId: created.taskId,
    logId: created.logId,
    providerKind: route.providerKind,
  };
}
