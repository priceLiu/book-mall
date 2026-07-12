import type { GatewayProviderKind, Prisma } from "@prisma/client";

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
  listWorldSplatUrls,
  operationErrorMessage,
  type WorldlabsContentRef,
  type WorldlabsOperation,
  type WorldlabsWorld,
  type WorldlabsWorldPrompt,
} from "@/lib/gateway/worldlabs-proxy";
import { findBuiltinWorldAssetEntry } from "@/lib/quick-replica/builtin-world-gallery-assets";
import { rememberWorldImageUrls } from "@/lib/quick-replica/qr-world-image-proxy";
import { rememberWorldSplatUrls } from "@/lib/quick-replica/qr-world-splat-proxy";
import {
  createUserQrTemplate,
  findQrTemplateByLogId,
  rowToJson,
} from "@/lib/quick-replica/qr-template-service";
import type { QrTemplateJson, QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";
import { prisma } from "@/lib/prisma";

const CLIENT_SOURCE = "QUICK_REPLICA" as const;

const WORLD_REF_VIEW_AZIMUTHS: Record<string, number> = {
  front: 0,
  right: 90,
  back: 180,
  left: 270,
};

export async function requireWorldlabsAuth(userId: string) {
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
  const snap = root.qrWorld ?? root.qrGenerate;
  if (!snap || typeof snap !== "object") return null;
  const record = snap as Record<string, unknown>;
  const draft = record.draft;
  if (!draft || typeof draft !== "object") return null;
  const parsed = draft as QrWorkspaceDraft;
  if (parsed.category === "world" && parsed.kind === "create-world") {
    return parsed;
  }
  return null;
}

export function extractWorldFromLogResult(resultSummary: unknown): WorldlabsWorld | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const root = resultSummary as Record<string, unknown>;
  if (root.world && typeof root.world === "object") {
    const world = root.world as WorldlabsWorld;
    if (world.world_id?.trim()) return world;
  }
  if (root.operation && typeof root.operation === "object") {
    return extractWorldFromOperation(root.operation as WorldlabsOperation);
  }
  return null;
}

function buildWorldTemplateModelParams(world: WorldlabsWorld): Record<string, unknown> {
  const splatUrls = world.assets?.splats?.spz_urls ?? {};
  return {
    world_id: world.world_id,
    world_marble_url: world.world_marble_url,
    tags: world.tags ?? [],
    splat_urls: splatUrls,
    pano_url: world.assets?.imagery?.pano_url?.trim() || null,
    collider_mesh_url: world.assets?.mesh?.collider_mesh_url?.trim() || null,
    thumbnail_source_url: world.assets?.thumbnail_url?.trim() || null,
  };
}

async function createUserWorldTemplateFromLog(args: {
  userId: string;
  logId: string;
  draft: QrWorkspaceDraft;
  world: WorldlabsWorld;
  outputUrl: string;
}): Promise<QrTemplateJson> {
  const thumb = extractWorldThumbnailUrl(args.world) || args.outputUrl;
  const title =
    args.draft.title?.trim() ||
    args.world.display_name?.trim() ||
    args.draft.prompt.trim().slice(0, 64) ||
    `场景 · ${new Date().toLocaleString("zh-CN")}`;

  rememberWorldSplatUrls(args.userId, args.world.world_id, listWorldSplatUrls(args.world));
  rememberWorldImageUrls(
    args.userId,
    args.world.world_id,
    [
      args.world.assets?.imagery?.pano_url?.trim(),
      extractWorldThumbnailUrl(args.world),
      ...args.draft.sceneImageUrls,
    ].filter((u): u is string => Boolean(u?.trim())),
  );

  const sceneImages = args.draft.sceneImageUrls.filter((u) => u.trim());
  const slots: QrTemplateJson["reference"]["slots"] = {};
  if (sceneImages.length > 0) {
    slots.sceneImages = sceneImages.map((url) => ({ url }));
  } else if (thumb) {
    slots.sceneImages = [{ url: thumb, label: "主场景" }];
  }

  const now = new Date().toISOString();
  return createUserQrTemplate({
    userId: args.userId,
    category: "world",
    kind: "create-world",
    title,
    thumbnailUrl: thumb,
    sortOrder: 0,
    gatewayRequestLogId: args.logId,
    reference: {
      slots,
      prompt: {
        text: args.draft.prompt,
        locale: /[\u4e00-\u9fff]/.test(args.draft.prompt) ? "zh" : "en",
      },
      model: {
        role: "IMAGE",
        modelKey: args.draft.modelKey.trim() || args.world.model?.trim() || "marble-1.1",
        params: buildWorldTemplateModelParams(args.world),
      },
    },
    output: {
      mediaType: "image",
      url: args.outputUrl,
      gatewayRequestLogId: args.logId,
      createdAt: now,
    },
  });
}

async function resolveWorldFromGenerateLog(
  userId: string,
  log: {
    resultSummary: unknown;
    externalTaskId: string | null;
  },
): Promise<WorldlabsWorld | null> {
  let world = extractWorldFromLogResult(log.resultSummary);
  if (world?.world_id) return world;

  const operationId = log.externalTaskId?.trim();
  if (!operationId) return null;

  try {
    const { credentialId } = await requireWorldlabsAuth(userId);
    const { operation } = await forwardWorldlabsGetOperation({
      credentialId,
      operationId,
    });
    world = extractWorldFromOperation(operation);
    if (world?.world_id) return world;
  } catch {
    return null;
  }
  return null;
}

async function repairWorldTemplateIfNeeded(
  userId: string,
  logId: string,
  existing: QrTemplateJson,
): Promise<QrTemplateJson> {
  const params = existing.reference?.model?.params;
  const hasWorldId = typeof params?.world_id === "string" && params.world_id.trim();
  if (hasWorldId) return existing;

  const log = await prisma.gatewayRequestLog.findFirst({
    where: { id: logId, actorBookUserId: userId, status: "SUCCEEDED" },
  });
  if (!log) return existing;

  const world = await resolveWorldFromGenerateLog(userId, log);
  if (!world?.world_id) return existing;

  const nextReference = {
    ...existing.reference,
    model: {
      ...existing.reference.model,
      params: {
        ...existing.reference.model.params,
        ...buildWorldTemplateModelParams(world),
      },
    },
  };

  const row = await prisma.qrTemplate.update({
    where: { id: existing.id, ownerUserId: userId },
    data: { reference: nextReference as Prisma.InputJsonValue },
  });
  return rowToJson(row);
}

/** 用户确认「保存为我的」后写入场景作品；补齐 world_id 等 Marble 元数据 */
export async function qrMaterializeWorldJobTemplate(
  userId: string,
  logId: string,
): Promise<QrTemplateJson | null> {
  const existing = await findQrTemplateByLogId(logId);
  if (existing) {
    return repairWorldTemplateIfNeeded(userId, logId, existing);
  }

  const log = await prisma.gatewayRequestLog.findFirst({
    where: { id: logId, actorBookUserId: userId },
  });
  if (!log || log.status !== "SUCCEEDED") return null;

  const draft = readWorldDraftFromLog(log);
  if (!draft || draft.kind !== "create-world") return null;

  const world = await resolveWorldFromGenerateLog(userId, log);
  if (!world?.world_id) return null;

  const out = extractWorldOutputFromLog(log.resultSummary);
  const outputUrl = out.outputUrl ?? out.worldMarbleUrl ?? world.world_marble_url;
  if (!outputUrl) return null;

  return createUserWorldTemplateFromLog({
    userId,
    logId,
    draft,
    world,
    outputUrl,
  });
}

/** 按作品 id 修复缺失的 world_id（打开旧场景作品时调用） */
export async function qrRepairWorldTemplateById(
  userId: string,
  templateId: string,
): Promise<{ template?: QrTemplateJson; error?: string }> {
  const row = await prisma.qrTemplate.findFirst({
    where: {
      id: templateId,
      ownerUserId: userId,
      deletedAt: null,
      category: "world",
    },
  });
  if (!row) {
    return { error: "作品不存在或无权访问" };
  }

  let template = rowToJson(row);
  const params = template.reference?.model?.params;
  if (typeof params?.world_id === "string" && params.world_id.trim()) {
    return { template };
  }

  const logId =
    row.gatewayRequestLogId?.trim() || template.output?.gatewayRequestLogId?.trim() || "";
  if (!logId) {
    return { error: "该条目缺少 world_id，且无法关联生成记录" };
  }

  template = await repairWorldTemplateIfNeeded(userId, logId, template);
  const repairedId = template.reference?.model?.params?.world_id;
  if (typeof repairedId === "string" && repairedId.trim()) {
    return { template };
  }

  const materialized = await qrMaterializeWorldJobTemplate(userId, logId);
  if (materialized && typeof materialized.reference?.model?.params?.world_id === "string") {
    return { template: materialized };
  }

  return { error: "该条目缺少 world_id" };
}

export type QrWorldViewerPayload = {
  worldId: string;
  displayName: string;
  worldMarbleUrl: string;
  /** 最佳单档（向后兼容）：等同 highResSpzUrl */
  spzUrl: string | null;
  /** OpenArt 预览档（100k），与 fullResSpzUrl 配对做两档渐进 */
  preview100kSpzUrl: string | null;
  /** OpenArt 高模档（full_res） */
  fullResSpzUrl: string | null;
  /** 低模档（100k/150k），先渲染出粒子的那份 */
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

  // 优先走本地内置世界库（右栏场景墙），不依赖实时官方 get world。
  const local = findBuiltinWorldAssetEntry(id);
  if (local) {
    const urls = local.spzUrlMap;
    const pick = (...keys: string[]): string | null => {
      for (const key of keys) {
        const u = urls[key];
        if (u?.trim()) return u.trim();
      }
      return null;
    };
    const preview100k = pick("100k");
    const fullRes = pick("full_res");
    const lowRes = pick("100k", "150k");
    const highRes = pick("full_res", "3m", "500k");
    const radUrl = pick("rad");
    const best = highRes ?? lowRes ?? preview100k ?? fullRes ?? local.splatUrls[0] ?? null;

    rememberWorldSplatUrls(userId, id, local.splatUrls);
    rememberWorldImageUrls(
      userId,
      id,
      [local.panoUrl, local.thumbnailUrl, ...local.sceneImageUrls].filter((u): u is string =>
        Boolean(u?.trim()),
      ),
    );
    return {
      worldId: id,
      displayName: local.title || "Marble World",
      worldMarbleUrl: local.worldMarbleUrl ?? `https://marble.worldlabs.ai/world/${id}`,
      spzUrl: best,
      preview100kSpzUrl: preview100k,
      fullResSpzUrl: fullRes,
      lowResSpzUrl: lowRes,
      highResSpzUrl: highRes ?? best,
      radUrl,
      panoUrl: local.panoUrl,
      thumbnailUrl: local.thumbnailUrl,
      colliderMeshUrl: local.colliderMeshUrl,
    };
  }

  const { credentialId } = await requireWorldlabsAuth(userId);
  const { world } = await forwardWorldlabsGetWorld({ credentialId, worldId: id });

  rememberWorldSplatUrls(userId, id, listWorldSplatUrls(world));
  rememberWorldImageUrls(userId, id, [
    world.assets?.imagery?.pano_url?.trim(),
    extractWorldThumbnailUrl(world),
  ].filter((u): u is string => Boolean(u?.trim())));

  const tiers = extractWorldSplatTiers(world);

  return {
    worldId: world.world_id,
    displayName: world.display_name?.trim() || "Marble World",
    worldMarbleUrl: world.world_marble_url,
    spzUrl: tiers.highRes ?? extractWorldSplatUrl(world),
    preview100kSpzUrl: tiers.preview100k,
    fullResSpzUrl: tiers.fullRes,
    lowResSpzUrl: tiers.lowRes,
    highResSpzUrl: tiers.highRes ?? extractWorldSplatUrl(world),
    radUrl: tiers.radUrl,
    panoUrl: world.assets?.imagery?.pano_url?.trim() || null,
    thumbnailUrl: extractWorldThumbnailUrl(world),
    colliderMeshUrl: world.assets?.mesh?.collider_mesh_url?.trim() || null,
  };
}
