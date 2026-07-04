import type { GatewayProviderKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, maskApiKey } from "@/lib/canvas/secret";
import { syncPersonalGatewayApiKeyBindings } from "@/lib/gateway/api-key-service";
import { resolveKieApiRoot, resolveOpenAiCompatibleBaseUrl } from "@/lib/gateway/model-router";
import { testGatewayCredentialConnection } from "@/lib/gateway/gateway-credential-test";

export const GATEWAY_PROVIDER_KINDS = [
  "KIE",
  "BAILIAN",
  "DEEPSEEK",
  "DASHSCOPE",
  "HUNYUAN",
  "VOLCENGINE",
  "MINIMAX",
  "WORLDLABS",
] as const satisfies readonly GatewayProviderKind[];

async function afterCredentialMutation(gatewayUserId: string): Promise<void> {
  await syncPersonalGatewayApiKeyBindings(gatewayUserId);
  const { syncCanonicalPlatformAdminKeyBindings } = await import(
    "@/lib/gateway/platform-credential-pool"
  );
  await syncCanonicalPlatformAdminKeyBindings(gatewayUserId);
}

export async function listGatewayCredentials(userId: string) {
  const rows = await prisma.gatewayVendorCredential.findMany({
    where: { userId },
    orderBy: [
      { providerKind: "asc" },
      { isDefaultForProvider: "desc" },
      { sortOrder: "asc" },
      { updatedAt: "desc" },
    ],
  });
  return rows.map((r) => ({
    id: r.id,
    alias: r.alias,
    providerKind: r.providerKind,
    baseUrl: r.baseUrl,
    active: r.active,
    channel: r.channel,
    sortOrder: r.sortOrder,
    isDefaultForProvider: r.isDefaultForProvider,
    apiKeyMasked: maskApiKey(r.apiKeyEncrypted),
    lastTestedAt: r.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: r.lastTestStatus,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createGatewayCredential(opts: {
  userId: string;
  alias: string;
  providerKind: GatewayProviderKind;
  apiKey: string;
  baseUrl?: string | null;
  channel?: string | null;
  sortOrder?: number;
  isDefaultForProvider?: boolean;
}) {
  const blob = encryptApiKey(opts.apiKey.trim());
  const rawBase = opts.baseUrl?.trim() || null;
  const baseUrl =
    rawBase &&
    (opts.providerKind === "BAILIAN" || opts.providerKind === "DASHSCOPE")
      ? resolveOpenAiCompatibleBaseUrl(opts.providerKind, rawBase)
      : rawBase &&
          opts.providerKind === "KIE"
        ? resolveKieApiRoot(rawBase)
        : rawBase;
  // 同厂商首条凭证自动设为默认；否则按入参
  const existingCount = await prisma.gatewayVendorCredential.count({
    where: { userId: opts.userId, providerKind: opts.providerKind },
  });
  const isDefault = opts.isDefaultForProvider ?? existingCount === 0;
  const row = await prisma.gatewayVendorCredential.create({
    data: {
      userId: opts.userId,
      alias: opts.alias.trim() || opts.providerKind,
      providerKind: opts.providerKind,
      apiKeyEncrypted: blob,
      baseUrl,
      ownerScope: "USER",
      ownerId: opts.userId,
      channel: opts.channel?.trim() || null,
      sortOrder: opts.sortOrder ?? 0,
      isDefaultForProvider: isDefault,
    },
  });
  if (isDefault) {
    await unsetOtherDefaults(opts.userId, opts.providerKind, row.id);
  }
  await afterCredentialMutation(opts.userId);
  return row;
}

/** 同一 userId+providerKind 仅保留一个默认凭证（取消其它默认）。 */
async function unsetOtherDefaults(
  userId: string,
  providerKind: GatewayProviderKind,
  keepId: string,
) {
  await prisma.gatewayVendorCredential.updateMany({
    where: {
      userId,
      providerKind,
      isDefaultForProvider: true,
      id: { not: keepId },
    },
    data: { isDefaultForProvider: false },
  });
}

/** 设某凭证为该厂商默认凭证（路由优先）。 */
export async function setDefaultGatewayCredential(userId: string, id: string) {
  const row = await prisma.gatewayVendorCredential.findFirst({
    where: { id, userId },
  });
  if (!row) return false;
  await prisma.gatewayVendorCredential.update({
    where: { id },
    data: { isDefaultForProvider: true },
  });
  await unsetOtherDefaults(userId, row.providerKind, id);
  return true;
}

export async function deleteGatewayCredential(userId: string, id: string) {
  const row = await prisma.gatewayVendorCredential.findFirst({
    where: { id, userId },
  });
  if (!row) return false;
  await prisma.gatewayVendorCredential.delete({ where: { id } });
  await afterCredentialMutation(userId);
  return true;
}

export async function updateGatewayCredential(
  userId: string,
  id: string,
  patch: {
    alias?: string;
    baseUrl?: string | null;
    active?: boolean;
    apiKey?: string;
    channel?: string | null;
    sortOrder?: number;
    isDefaultForProvider?: boolean;
  },
) {
  const row = await prisma.gatewayVendorCredential.findFirst({
    where: { id, userId },
  });
  if (!row) return null;

  let baseUrl = row.baseUrl;
  if (patch.baseUrl !== undefined) {
    const raw = patch.baseUrl?.trim() || null;
    baseUrl =
      raw &&
      (row.providerKind === "BAILIAN" || row.providerKind === "DASHSCOPE")
        ? resolveOpenAiCompatibleBaseUrl(row.providerKind, raw)
        : raw && row.providerKind === "KIE"
          ? resolveKieApiRoot(raw)
          : raw;
  }

  const updated = await prisma.gatewayVendorCredential.update({
    where: { id },
    data: {
      ...(patch.alias !== undefined ? { alias: patch.alias.trim() || row.providerKind } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.baseUrl !== undefined ? { baseUrl } : {}),
      ...(patch.channel !== undefined ? { channel: patch.channel?.trim() || null } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
      ...(patch.isDefaultForProvider !== undefined
        ? { isDefaultForProvider: patch.isDefaultForProvider }
        : {}),
      ...(patch.apiKey?.trim()
        ? { apiKeyEncrypted: encryptApiKey(patch.apiKey.trim()) }
        : {}),
    },
  });
  if (patch.isDefaultForProvider) {
    await unsetOtherDefaults(userId, row.providerKind, id);
  }
  if (
    patch.active !== undefined ||
    patch.apiKey !== undefined ||
    patch.isDefaultForProvider !== undefined
  ) {
    await afterCredentialMutation(userId);
  }
  return updated;
}

export async function cloneGatewayCredential(
  userId: string,
  id: string,
  alias: string,
) {
  const row = await prisma.gatewayVendorCredential.findFirst({
    where: { id, userId },
  });
  if (!row) return null;
  const cloned = await prisma.gatewayVendorCredential.create({
    data: {
      userId,
      alias: alias.trim() || `${row.alias} 副本`,
      providerKind: row.providerKind,
      apiKeyEncrypted: row.apiKeyEncrypted,
      baseUrl: row.baseUrl,
      active: row.active,
    },
  });
  if (cloned.active) {
    await afterCredentialMutation(userId);
  }
  return cloned;
}

export async function testGatewayCredential(userId: string, id: string) {
  const row = await prisma.gatewayVendorCredential.findFirst({
    where: { id, userId },
  });
  if (!row) return { found: false as const };

  const result = await testGatewayCredentialConnection(row);
  await prisma.gatewayVendorCredential.update({
    where: { id },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: result.ok
        ? "ok"
        : `error: ${(result.message ?? "unknown").slice(0, 200)}`,
    },
  });
  return { found: true as const, ...result };
}

export async function getGatewayCredentialForUser(userId: string, id: string) {
  return prisma.gatewayVendorCredential.findFirst({
    where: { id, userId },
  });
}

export async function getDecryptedCredentialApiKey(
  credentialId: string,
): Promise<{ apiKey: string; baseUrl: string | null; providerKind: GatewayProviderKind } | null> {
  const { decryptApiKey } = await import("@/lib/canvas/secret");
  const row = await prisma.gatewayVendorCredential.findUnique({
    where: { id: credentialId },
  });
  if (!row || !row.active) return null;
  return {
    apiKey: decryptApiKey(row.apiKeyEncrypted),
    baseUrl: row.baseUrl,
    providerKind: row.providerKind,
  };
}
