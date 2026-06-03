import type { GatewayProviderKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, maskApiKey } from "@/lib/canvas/secret";
import { resolveOpenAiCompatibleBaseUrl } from "@/lib/gateway/model-router";
import { testGatewayCredentialConnection } from "@/lib/gateway/gateway-credential-test";

export const GATEWAY_PROVIDER_KINDS = [
  "KIE",
  "BAILIAN",
  "DEEPSEEK",
  "DASHSCOPE",
  "HUNYUAN",
  "VOLCENGINE",
] as const satisfies readonly GatewayProviderKind[];

export async function listGatewayCredentials(userId: string) {
  const rows = await prisma.gatewayVendorCredential.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    alias: r.alias,
    providerKind: r.providerKind,
    baseUrl: r.baseUrl,
    active: r.active,
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
}) {
  const blob = encryptApiKey(opts.apiKey.trim());
  const rawBase = opts.baseUrl?.trim() || null;
  const baseUrl =
    rawBase &&
    (opts.providerKind === "BAILIAN" || opts.providerKind === "DASHSCOPE")
      ? resolveOpenAiCompatibleBaseUrl(opts.providerKind, rawBase)
      : rawBase;
  return prisma.gatewayVendorCredential.create({
    data: {
      userId: opts.userId,
      alias: opts.alias.trim() || opts.providerKind,
      providerKind: opts.providerKind,
      apiKeyEncrypted: blob,
      baseUrl,
    },
  });
}

export async function deleteGatewayCredential(userId: string, id: string) {
  const row = await prisma.gatewayVendorCredential.findFirst({
    where: { id, userId },
  });
  if (!row) return false;
  await prisma.gatewayVendorCredential.delete({ where: { id } });
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
        : raw;
  }

  return prisma.gatewayVendorCredential.update({
    where: { id },
    data: {
      ...(patch.alias !== undefined ? { alias: patch.alias.trim() || row.providerKind } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.baseUrl !== undefined ? { baseUrl } : {}),
      ...(patch.apiKey?.trim()
        ? { apiKeyEncrypted: encryptApiKey(patch.apiKey.trim()) }
        : {}),
    },
  });
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
  return prisma.gatewayVendorCredential.create({
    data: {
      userId,
      alias: alias.trim() || `${row.alias} 副本`,
      providerKind: row.providerKind,
      apiKeyEncrypted: row.apiKeyEncrypted,
      baseUrl: row.baseUrl,
      active: row.active,
    },
  });
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
