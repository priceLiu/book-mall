import type { GatewayProviderKind } from "@prisma/client";

import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import {
  createRequestLog,
  finalizeRequestLog,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import {
  resolveWorldlabsMarbleModelKey,
  WORLDLABS_DEFAULT_MARBLE_MODEL_KEY,
} from "@/lib/gateway/worldlabs-marble-models";
import {
  extractWorldFromOperation,
  extractWorldSplatTiers,
  extractWorldSplatUrl,
  extractWorldThumbnailUrl,
  forwardWorldlabsGenerateWorld,
  forwardWorldlabsGetOperation,
  forwardWorldlabsGetWorld,
  operationErrorMessage,
  type WorldlabsContentRef,
  type WorldlabsWorldPrompt,
} from "@/lib/gateway/worldlabs-proxy";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";
import { prisma } from "@/lib/prisma";

const CLIENT_SOURCE = "QUICK_REPLICA" as const;

const WORLD_REF_VIEW_AZIMUTHS: Record<string, number> = {
  front: 0,
  right: 90,
  back: 180,
  left: 270,
};

async function requireWorldlabsAuth(userId: string) {
  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心关联 Gateway API Key");
  }
  const credentialId = pickCredentialForKind(auth.credentials, "WORLDLABS");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 World Labs 凭证");
  }
  return { auth, credentialId };
}

function uriContent(url: string): WorldlabsContentRef {
  return { source: "uri", uri: url.trim() };
}

function resolveRefAzimuth(draft: QrWorkspaceDraft, index: number): number | null {
  const raw = draft.worldRefAzimuths?.[index];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const labels = ["front", "right", "back", "left"];
  return WORLD_REF_VIEW_AZIMUTHS[labels[index % labels.length]!] ?? null;
}

export function buildWorldlabsWorldPrompt(draft: QrWorkspaceDraft): WorldlabsWorldPrompt {
  const text = draft.prompt.trim();
  const imageUrls = draft.sceneImageUrls.map((u) => u.trim()).filter(Boolean);
  const videoUrl = draft.referenceVideoUrl.trim();

  if (videoUrl) {
    return {
      type: "video",
      video_prompt: uriContent(videoUrl),
      ...(text ? { text_prompt: text } : {}),
    };
  }

  if (imageUrls.length >= 2) {
    return {
      type: "multi-image",
      multi_image_prompt: imageUrls.map((uri, index) => ({
        azimuth: resolveRefAzimuth(draft, index),
        content: uriContent(uri),
      })),
      ...(text ? { text_prompt: text } : {}),
      reconstruct_images: draft.worldAutoLayout ?? false,
    };
  }

  if (imageUrls.length === 1) {
    const isPano = draft.worldIsPano ?? "auto";
    return {
      type: "image",
      image_prompt: uriContent(imageUrls[0]!),
      ...(text ? { text_prompt: text } : {}),
      is_pano: isPano,
    };
  }

  return {
    type: "text",
    text_prompt: text,
  };
}

export function validateWorldGenerateDraft(draft: QrWorkspaceDraft): string | null {
  if (draft.kind !== "create-world") return "仅支持 create-world";
  const prompt = buildWorldlabsWorldPrompt(draft);
  if (prompt.type === "text" && !prompt.text_prompt.trim()) {
    return "请输入场景描述或添加参考图";
  }
  return null;
}

export async function qrCreateWorldJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind }> {
  const validationError = validateWorldGenerateDraft(draft);
  if (validationError) throw new Error(validationError);

  const { auth, credentialId } = await requireWorldlabsAuth(userId);
  const modelKey = resolveWorldlabsMarbleModelKey(
    draft.modelKey.trim() || WORLDLABS_DEFAULT_MARBLE_MODEL_KEY,
  );
  const worldPrompt = buildWorldlabsWorldPrompt(draft);
  const displayName =
    draft.title?.trim().slice(0, 64) ||
    draft.prompt.trim().slice(0, 64) ||
    "QuickReplica World";

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: modelKey,
    endpoint: "/marble/v1/worlds:generate",
    providerKind: "WORLDLABS",
    requestKind: "OTHER",
    clientSource: CLIENT_SOURCE,
    clientPage: "quick-replica/create-world",
    actorBookUserId: userId,
    inputSummary: { qrWorld: { draft } },
  });

  try {
    const { operation } = await forwardWorldlabsGenerateWorld({
      credentialId,
      body: {
        display_name: displayName,
        model: modelKey,
        world_prompt: worldPrompt,
      },
    });

    await prisma.gatewayRequestLog.update({
      where: { id: log.id },
      data: {
        externalTaskId: operation.operation_id,
        status: operation.done ? (operation.error ? "FAILED" : "SUCCEEDED") : "RUNNING",
      },
    });

    if (operation.done && operation.error) {
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: 0,
        failMessage: operationErrorMessage(operation) ?? "生成失败",
        resultSummary: { operation },
        model: modelKey,
      });
      throw new Error(operationErrorMessage(operation) ?? "生成失败");
    }

    if (operation.done && !operation.error) {
      const world = extractWorldFromOperation(operation);
      const thumb = world ? extractWorldThumbnailUrl(world) : null;
      await finalizeRequestLog(log.id, {
        status: "SUCCEEDED",
        durationMs: 0,
        resultSummary: {
          world,
          world_marble_url: world?.world_marble_url,
          thumbnail_url: thumb,
          url: thumb ?? world?.world_marble_url,
        },
        model: modelKey,
      });
    }

    return { logId: log.id, taskId: operation.operation_id, providerKind: "WORLDLABS" };
  } catch (err) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: 0,
      failMessage: err instanceof Error ? err.message : "生成失败",
      model: modelKey,
    });
    throw err;
  }
}

export type QrWorldPollResult = {
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  outputUrl?: string;
  worldMarbleUrl?: string;
  error?: string;
};

export async function qrPollWorldJob(
  userId: string,
  logId: string,
): Promise<QrWorldPollResult> {
  const log = await prisma.gatewayRequestLog.findFirst({
    where: { id: logId, actorBookUserId: userId },
  });
  if (!log) return { status: "FAILED", error: "任务不存在" };

  if (log.status === "SUCCEEDED") {
    const out = extractWorldOutputFromLog(log.resultSummary);
    return {
      status: "SUCCEEDED",
      outputUrl: out.outputUrl,
      worldMarbleUrl: out.worldMarbleUrl,
    };
  }
  if (log.status === "FAILED") {
    return { status: "FAILED", error: log.failMessage ?? "生成失败" };
  }

  const operationId = log.externalTaskId?.trim();
  if (!operationId) return { status: "PENDING" };

  const { credentialId } = await requireWorldlabsAuth(userId);
  const { operation } = await forwardWorldlabsGetOperation({
    credentialId,
    operationId,
  });

  if (!operation.done) {
    return { status: "RUNNING" };
  }

  if (operation.error) {
    const msg = operationErrorMessage(operation) ?? "生成失败";
    await finalizeRequestLog(logId, {
      status: "FAILED",
      durationMs: log.submittedAt ? Date.now() - log.submittedAt.getTime() : 0,
      failMessage: msg,
      resultSummary: { operation },
      model: log.model,
    });
    return { status: "FAILED", error: msg };
  }

  const world = extractWorldFromOperation(operation);
  const thumb = world ? extractWorldThumbnailUrl(world) : null;
  const outputUrl = thumb ?? world?.world_marble_url ?? undefined;
  const worldMarbleUrl = world?.world_marble_url;

  await finalizeRequestLog(logId, {
    status: "SUCCEEDED",
    durationMs: log.submittedAt ? Date.now() - log.submittedAt.getTime() : 0,
    resultSummary: {
      operation,
      world,
      world_marble_url: worldMarbleUrl,
      thumbnail_url: thumb,
      url: outputUrl,
    },
    model: log.model,
  });

  return {
    status: "SUCCEEDED",
    outputUrl,
    worldMarbleUrl,
  };
}

export function extractWorldOutputFromLog(resultSummary: unknown): {
  outputUrl?: string;
  worldMarbleUrl?: string;
} {
  if (!resultSummary || typeof resultSummary !== "object") return {};
  const root = resultSummary as Record<string, unknown>;
  const worldMarbleUrl =
    typeof root.world_marble_url === "string"
      ? root.world_marble_url
      : root.world && typeof root.world === "object"
        ? typeof (root.world as Record<string, unknown>).world_marble_url === "string"
          ? String((root.world as Record<string, unknown>).world_marble_url)
          : undefined
        : undefined;
  const outputUrl =
    typeof root.url === "string"
      ? root.url
      : typeof root.thumbnail_url === "string"
        ? root.thumbnail_url
        : worldMarbleUrl;
  return { outputUrl, worldMarbleUrl };
}

export function readWorldDraftFromLog(log: {
  inputSummary: unknown;
}): QrWorkspaceDraft | null {
  if (!log.inputSummary || typeof log.inputSummary !== "object") return null;
  const root = log.inputSummary as Record<string, unknown>;
  const snap = root.qrWorld;
  if (!snap || typeof snap !== "object") return null;
  const draft = (snap as Record<string, unknown>).draft;
  if (!draft || typeof draft !== "object") return null;
  return draft as QrWorkspaceDraft;
}

export type QrWorldViewerPayload = {
  worldId: string;
  displayName: string;
  worldMarbleUrl: string;
  /** 最佳单档（向后兼容）：等同 highResSpzUrl */
  spzUrl: string | null;
  /** 低模档（150k/100k），先渲染出粒子的那份 */
  lowResSpzUrl: string | null;
  /** 高模档（full_res/3m/500k），揭示后的清晰画质 */
  highResSpzUrl: string | null;
  /** RAD LoD 流式资产（存在则由 Spark 内部渐进流式） */
  radUrl: string | null;
  panoUrl: string | null;
  thumbnailUrl: string | null;
  colliderMeshUrl: string | null;
};

export async function qrGetWorldViewerPayload(
  userId: string,
  worldId: string,
): Promise<QrWorldViewerPayload> {
  const id = worldId.trim();
  if (!id) throw new Error("缺少 world_id");

  const { credentialId } = await requireWorldlabsAuth(userId);
  const { world } = await forwardWorldlabsGetWorld({ credentialId, worldId: id });

  const tiers = extractWorldSplatTiers(world);

  return {
    worldId: world.world_id,
    displayName: world.display_name?.trim() || "Marble World",
    worldMarbleUrl: world.world_marble_url,
    spzUrl: tiers.highRes ?? extractWorldSplatUrl(world),
    lowResSpzUrl: tiers.lowRes,
    highResSpzUrl: tiers.highRes ?? extractWorldSplatUrl(world),
    radUrl: tiers.radUrl,
    panoUrl: world.assets?.imagery?.pano_url?.trim() || null,
    thumbnailUrl: extractWorldThumbnailUrl(world),
    colliderMeshUrl: world.assets?.mesh?.collider_mesh_url?.trim() || null,
  };
}
