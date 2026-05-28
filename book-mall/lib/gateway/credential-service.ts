import type { GatewayProviderKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, maskApiKey } from "@/lib/canvas/secret";
import { resolveOpenAiCompatibleBaseUrl } from "@/lib/gateway/model-router";

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
