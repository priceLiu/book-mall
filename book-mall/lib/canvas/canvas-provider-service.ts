/**
 * canvas v2 · Provider 业务服务
 *
 * - listProvidersForUser: 列出用户 providers（含 models，apiKey 脱敏）
 * - createProviderForUser: 创建 + 自动 fetch model list
 * - updateProvider / deleteProvider / testProvider / refreshProviderModels
 *
 * 所有方法保证 user 隔离（按 userId 过滤）。
 */

import { Prisma, type CanvasProvider, type CanvasProviderKind, type CanvasProviderModel } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { encryptApiKey, maskApiKey } from "./secret";
import {
  CanvasGatewayError,
  buildGatewayConfig,
  getGatewayForKind,
} from "./providers";
import type { CanvasParamSchema } from "./providers/types";

export class CanvasProviderError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "INVALID_INPUT"
      | "FORBIDDEN"
      | "DUPLICATE_ALIAS"
      | "GATEWAY_FAILED"
      | "SECRET_KEY_MISSING",
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "CanvasProviderError";
  }
}

const MAX_ALIAS = 60;
const ALLOWED_KINDS: CanvasProviderKind[] = [
  "KIE",
  "ALI_BAILIAN",
  "OPENAI_COMPAT",
  "GEMINI_NATIVE",
  "HUNYUAN_3D",
];

export type CanvasProviderModelDto = {
  id: string;
  modelKey: string;
  displayName: string;
  role: "IMAGE" | "VIDEO" | "LLM";
  description: string | null;
  paramsSchema: CanvasParamSchema | null;
  defaultParams: Record<string, unknown> | null;
  enabled: boolean;
  sortOrder: number;
};

export type CanvasProviderDto = {
  id: string;
  alias: string;
  kind: CanvasProviderKind;
  baseUrl: string | null;
  apiKeyMasked: string;
  active: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  models: CanvasProviderModelDto[];
  createdAt: string;
  updatedAt: string;
};

function toModelDto(m: CanvasProviderModel): CanvasProviderModelDto {
  return {
    id: m.id,
    modelKey: m.modelKey,
    displayName: m.displayName,
    role: m.role,
    description: m.description,
    paramsSchema: (m.paramsSchema as CanvasParamSchema | null) ?? null,
    defaultParams:
      (m.defaultParams as Record<string, unknown> | null) ?? null,
    enabled: m.enabled,
    sortOrder: m.sortOrder,
  };
}

function toProviderDto(
  p: CanvasProvider & { models: CanvasProviderModel[] },
): CanvasProviderDto {
  return {
    id: p.id,
    alias: p.alias,
    kind: p.kind,
    baseUrl: p.baseUrl,
    apiKeyMasked: maskApiKey(p.apiKeyEncrypted),
    active: p.active,
    lastTestedAt: p.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: p.lastTestStatus,
    models: p.models
      .slice()
      .sort((a, b) =>
        a.sortOrder !== b.sortOrder
          ? a.sortOrder - b.sortOrder
          : a.modelKey.localeCompare(b.modelKey),
      )
      .map(toModelDto),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listProvidersForUser(
  userId: string,
): Promise<CanvasProviderDto[]> {
  const rows = await prisma.canvasProvider.findMany({
    where: { userId },
    include: { models: true },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toProviderDto);
}

export async function getProviderForUser(
  userId: string,
  providerId: string,
): Promise<(CanvasProvider & { models: CanvasProviderModel[] }) | null> {
  return prisma.canvasProvider.findFirst({
    where: { id: providerId, userId },
    include: { models: true },
  });
}

export type CreateProviderInput = {
  alias: string;
  kind: CanvasProviderKind;
  apiKey: string;
  baseUrl?: string | null;
};

export async function createProviderForUser(
  userId: string,
  input: CreateProviderInput,
): Promise<CanvasProviderDto> {
  const alias = (input.alias ?? "").trim();
  if (!alias || alias.length > MAX_ALIAS) {
    throw new CanvasProviderError(
      "INVALID_INPUT",
      `别名长度需为 1-${MAX_ALIAS}`,
    );
  }
  if (!ALLOWED_KINDS.includes(input.kind)) {
    throw new CanvasProviderError("INVALID_INPUT", `不支持的 kind: ${input.kind}`);
  }
  const apiKey = (input.apiKey ?? "").trim();
  if (!apiKey) throw new CanvasProviderError("INVALID_INPUT", "apiKey 不能为空");
  if (input.kind === "OPENAI_COMPAT" && !input.baseUrl) {
    throw new CanvasProviderError(
      "INVALID_INPUT",
      "OPENAI_COMPAT 必须提供 baseUrl",
    );
  }
  const baseUrl = input.baseUrl?.trim() || null;

  // 同用户 alias 不重复
  const dup = await prisma.canvasProvider.findFirst({
    where: { userId, alias },
    select: { id: true },
  });
  if (dup) {
    throw new CanvasProviderError("DUPLICATE_ALIAS", "别名已存在", 409);
  }

  const apiKeyEncrypted = encryptApiKey(apiKey);

  const provider = await prisma.canvasProvider.create({
    data: {
      userId,
      alias,
      kind: input.kind,
      apiKeyEncrypted,
      baseUrl,
      active: true,
    },
  });

  // 尝试拉模型清单（失败也允许 provider 已创建；状态写入 lastTestStatus）
  let modelsListed = 0;
  let warning: string | null = null;
  try {
    const gateway = getGatewayForKind(input.kind, {
      id: provider.id,
      alias,
      kind: input.kind,
      apiKey,
      baseUrl,
    });
    const result = await gateway.listModels();
    modelsListed = result.models.length;
    warning = result.warning ?? null;
    if (result.models.length > 0) {
      await prisma.canvasProviderModel.createMany({
        data: result.models.map((m, idx) => ({
          providerId: provider.id,
          modelKey: m.modelKey,
          displayName: m.displayName,
          role: m.role,
          description: m.description ?? null,
          paramsSchema: (m.paramsSchema ?? null) as Prisma.InputJsonValue | undefined,
          defaultParams:
            (m.defaultParams ?? null) as Prisma.InputJsonValue | undefined,
          enabled: true,
          sortOrder: idx,
        })),
        skipDuplicates: true,
      });
    }
  } catch (e) {
    warning = (e as Error).message;
  }
  await prisma.canvasProvider.update({
    where: { id: provider.id },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: warning
        ? `created:${modelsListed} models, warning: ${warning.slice(0, 200)}`
        : `created:${modelsListed} models`,
    },
  });

  const fresh = await prisma.canvasProvider.findUniqueOrThrow({
    where: { id: provider.id },
    include: { models: true },
  });
  return toProviderDto(fresh);
}

export type UpdateProviderInput = {
  alias?: string;
  apiKey?: string;
  baseUrl?: string | null;
  active?: boolean;
};

export async function updateProviderForUser(
  userId: string,
  providerId: string,
  input: UpdateProviderInput,
): Promise<CanvasProviderDto> {
  const exist = await prisma.canvasProvider.findFirst({
    where: { id: providerId, userId },
    select: { id: true, alias: true, kind: true },
  });
  if (!exist) throw new CanvasProviderError("NOT_FOUND", "Provider 不存在", 404);

  const data: Prisma.CanvasProviderUpdateInput = {};
  if (typeof input.alias === "string") {
    const alias = input.alias.trim();
    if (!alias || alias.length > MAX_ALIAS) {
      throw new CanvasProviderError(
        "INVALID_INPUT",
        `别名长度需为 1-${MAX_ALIAS}`,
      );
    }
    if (alias !== exist.alias) {
      const dup = await prisma.canvasProvider.findFirst({
        where: { userId, alias, id: { not: providerId } },
        select: { id: true },
      });
      if (dup)
        throw new CanvasProviderError("DUPLICATE_ALIAS", "别名已存在", 409);
      data.alias = alias;
    }
  }
  if (typeof input.apiKey === "string" && input.apiKey.trim()) {
    data.apiKeyEncrypted = encryptApiKey(input.apiKey.trim());
  }
  if (input.baseUrl !== undefined) {
    if (exist.kind === "OPENAI_COMPAT" && !input.baseUrl) {
      throw new CanvasProviderError(
        "INVALID_INPUT",
        "OPENAI_COMPAT 必须提供 baseUrl",
      );
    }
    data.baseUrl = input.baseUrl ? input.baseUrl.trim() : null;
  }
  if (typeof input.active === "boolean") {
    data.active = input.active;
  }

  await prisma.canvasProvider.update({ where: { id: providerId }, data });
  const fresh = await prisma.canvasProvider.findUniqueOrThrow({
    where: { id: providerId },
    include: { models: true },
  });
  return toProviderDto(fresh);
}

export async function deleteProviderForUser(
  userId: string,
  providerId: string,
): Promise<void> {
  const r = await prisma.canvasProvider.deleteMany({
    where: { id: providerId, userId },
  });
  if (r.count === 0) {
    throw new CanvasProviderError("NOT_FOUND", "Provider 不存在", 404);
  }
}

export async function testProviderForUser(
  userId: string,
  providerId: string,
): Promise<{ ok: boolean; message?: string }> {
  const provider = await prisma.canvasProvider.findFirst({
    where: { id: providerId, userId },
  });
  if (!provider)
    throw new CanvasProviderError("NOT_FOUND", "Provider 不存在", 404);
  let result: { ok: boolean; message?: string };
  try {
    const gateway = getGatewayForKind(provider.kind, buildGatewayConfig(provider));
    result = await gateway.testConnection();
  } catch (e) {
    if (e instanceof CanvasGatewayError) {
      result = { ok: false, message: `[${e.code}] ${e.message}` };
    } else {
      result = { ok: false, message: (e as Error).message };
    }
  }
  await prisma.canvasProvider.update({
    where: { id: providerId },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: result.ok
        ? "ok"
        : `error: ${(result.message ?? "unknown").slice(0, 200)}`,
    },
  });
  return result;
}

export async function refreshProviderModelsForUser(
  userId: string,
  providerId: string,
): Promise<CanvasProviderDto> {
  const provider = await prisma.canvasProvider.findFirst({
    where: { id: providerId, userId },
  });
  if (!provider)
    throw new CanvasProviderError("NOT_FOUND", "Provider 不存在", 404);

  const gateway = getGatewayForKind(provider.kind, buildGatewayConfig(provider));
  const result = await gateway.listModels();

  // 用 upsert 而不是 deleteMany；保留 user 既有 enabled/sortOrder
  for (const [idx, m] of result.models.entries()) {
    await prisma.canvasProviderModel.upsert({
      where: {
        providerId_modelKey: { providerId, modelKey: m.modelKey },
      },
      create: {
        providerId,
        modelKey: m.modelKey,
        displayName: m.displayName,
        role: m.role,
        description: m.description ?? null,
        paramsSchema: (m.paramsSchema ?? null) as Prisma.InputJsonValue | undefined,
        defaultParams:
          (m.defaultParams ?? null) as Prisma.InputJsonValue | undefined,
        enabled: true,
        sortOrder: idx,
      },
      update: {
        displayName: m.displayName,
        description: m.description ?? null,
        paramsSchema: (m.paramsSchema ?? null) as Prisma.InputJsonValue | undefined,
        defaultParams:
          (m.defaultParams ?? null) as Prisma.InputJsonValue | undefined,
      },
    });
  }
  await prisma.canvasProvider.update({
    where: { id: providerId },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: result.warning
        ? `models:${result.models.length} (warn: ${result.warning.slice(0, 200)})`
        : `models:${result.models.length}`,
    },
  });
  const fresh = await prisma.canvasProvider.findUniqueOrThrow({
    where: { id: providerId },
    include: { models: true },
  });
  return toProviderDto(fresh);
}

export async function updateProviderModelForUser(
  userId: string,
  providerId: string,
  modelId: string,
  input: { enabled?: boolean; sortOrder?: number; displayName?: string },
): Promise<CanvasProviderModelDto> {
  // 确认 provider 归属
  const provider = await prisma.canvasProvider.findFirst({
    where: { id: providerId, userId },
    select: { id: true },
  });
  if (!provider)
    throw new CanvasProviderError("NOT_FOUND", "Provider 不存在", 404);
  const data: Prisma.CanvasProviderModelUpdateInput = {};
  if (typeof input.enabled === "boolean") data.enabled = input.enabled;
  if (typeof input.sortOrder === "number") data.sortOrder = input.sortOrder;
  if (typeof input.displayName === "string" && input.displayName.trim()) {
    data.displayName = input.displayName.trim();
  }
  const updated = await prisma.canvasProviderModel.update({
    where: { id: modelId },
    data,
  });
  if (updated.providerId !== providerId) {
    throw new CanvasProviderError("FORBIDDEN", "模型不属于该 Provider", 403);
  }
  return toModelDto(updated);
}
