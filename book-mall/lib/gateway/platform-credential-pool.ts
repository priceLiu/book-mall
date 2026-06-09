/**
 * 平台代付（PLATFORM_CREDIT）用户托管 sk-gw 绑定的厂商凭证池。
 * 优先级：PLATFORM_VENDOR_CREDENTIAL_IDS env → PLATFORM_GATEWAY_API_KEY_ID env → DB Platform Admin Key。
 */
import type { GatewayProviderKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { PLATFORM_ADMIN_KEY_NAME } from "@/lib/gateway/key-scope";
import {
  findCanonicalPlatformAdminApiKey,
  getCanonicalPlatformPoolOwnerEmail,
  getPlatformGatewayAdminEmails,
} from "@/lib/gateway/platform-credential-copy";

function parsePlatformCredentialIds(): string[] {
  const raw = process.env.PLATFORM_VENDOR_CREDENTIAL_IDS?.trim();
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function findPlatformAdminApiKey() {
  const canonical = await findCanonicalPlatformAdminApiKey();
  if (canonical) {
    return {
      ...canonical,
      bindings: canonical.bindings.map((b) => ({
        credentialId: b.credentialId,
        credential: {
          id: b.credential.id,
          alias: b.credential.alias,
          providerKind: b.credential.providerKind,
          active: b.credential.active,
          channel: b.credential.channel,
        },
      })),
    };
  }

  const envKeyId = process.env.PLATFORM_GATEWAY_API_KEY_ID?.trim();
  if (envKeyId) {
    const keyed = await prisma.gatewayApiKey.findFirst({
      where: { id: envKeyId, scope: "PLATFORM", revokedAt: null },
      include: {
        bindings: {
          include: {
            credential: {
              select: {
                id: true,
                alias: true,
                providerKind: true,
                active: true,
                channel: true,
              },
            },
          },
        },
        user: { select: { email: true, id: true } },
      },
    });
    if (keyed) return keyed;
  }

  return prisma.gatewayApiKey.findFirst({
    where: { scope: "PLATFORM", revokedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      bindings: {
        include: {
          credential: {
            select: {
              id: true,
              alias: true,
              providerKind: true,
              active: true,
              channel: true,
            },
          },
        },
      },
      user: { select: { email: true, id: true } },
    },
  });
}

/** 平台厂商凭证 ID 列表（供 managed sk-gw 绑定） */
export async function resolvePlatformVendorCredentialIds(): Promise<string[]> {
  const fromEnv = parsePlatformCredentialIds();
  if (fromEnv.length > 0) return fromEnv;

  const platformKey = await findPlatformAdminApiKey();
  if (platformKey && platformKey.bindings.length > 0) {
    return platformKey.bindings.map((b) => b.credentialId);
  }

  return [];
}

export type PlatformCredentialPoolStatus = {
  source: "env_ids" | "env_key" | "db_platform_admin" | "empty";
  canonicalOwnerEmail: string;
  platformGatewayAdminEmails: string[];
  platformKeyId: string | null;
  platformKeyName: string | null;
  gatewayOwnerEmail: string | null;
  credentials: Array<{
    id: string;
    alias: string;
    providerKind: GatewayProviderKind;
    active: boolean;
  }>;
  managedKeyCount: number;
  adminCopies: Array<{ email: string; platformKeyId: string | null; credentialCount: number }>;
};

export async function getPlatformCredentialPoolStatus(): Promise<PlatformCredentialPoolStatus> {
  const fromEnv = parsePlatformCredentialIds();
  if (fromEnv.length > 0) {
    const creds = await prisma.gatewayVendorCredential.findMany({
      where: { id: { in: fromEnv } },
      select: { id: true, alias: true, providerKind: true, active: true },
    });
    const managedKeyCount = await prisma.gatewayApiKey.count({
      where: { managedByPlatform: true, revokedAt: null },
    });
    return {
      source: "env_ids",
      canonicalOwnerEmail: getCanonicalPlatformPoolOwnerEmail(),
      platformGatewayAdminEmails: getPlatformGatewayAdminEmails(),
      platformKeyId: process.env.PLATFORM_GATEWAY_API_KEY_ID?.trim() ?? null,
      platformKeyName: PLATFORM_ADMIN_KEY_NAME,
      gatewayOwnerEmail: null,
      credentials: creds,
      managedKeyCount,
      adminCopies: [],
    };
  }

  const platformKey = await findPlatformAdminApiKey();
  const managedKeyCount = await prisma.gatewayApiKey.count({
    where: { managedByPlatform: true, revokedAt: null },
  });

  const adminCopies = await Promise.all(
    getPlatformGatewayAdminEmails()
      .filter((e) => e !== getCanonicalPlatformPoolOwnerEmail())
      .map(async (email) => {
        const gw = await prisma.gatewayUser.findUnique({
          where: { email },
          select: {
            credentials: { where: { active: true }, select: { id: true } },
            apiKeys: {
              where: { scope: "PLATFORM", revokedAt: null },
              select: { id: true },
              take: 1,
            },
          },
        });
        return {
          email,
          platformKeyId: gw?.apiKeys[0]?.id ?? null,
          credentialCount: gw?.credentials.length ?? 0,
        };
      }),
  );

  if (!platformKey) {
    return {
      source: "empty",
      canonicalOwnerEmail: getCanonicalPlatformPoolOwnerEmail(),
      platformGatewayAdminEmails: getPlatformGatewayAdminEmails(),
      platformKeyId: null,
      platformKeyName: null,
      gatewayOwnerEmail: null,
      credentials: [],
      managedKeyCount,
      adminCopies,
    };
  }

  const source = process.env.PLATFORM_GATEWAY_API_KEY_ID?.trim() ? "env_key" : "db_platform_admin";

  return {
    source,
    canonicalOwnerEmail: getCanonicalPlatformPoolOwnerEmail(),
    platformGatewayAdminEmails: getPlatformGatewayAdminEmails(),
    platformKeyId: platformKey.id,
    platformKeyName: platformKey.name,
    gatewayOwnerEmail: platformKey.user.email,
    credentials: platformKey.bindings.map((b) => b.credential),
    managedKeyCount,
    adminCopies,
  };
}

/** canonical 账号：将全部 active 凭证绑到 Platform Admin Key，并刷新托管 sk-gw */
export async function syncCanonicalPlatformAdminKeyBindings(
  gatewayUserId: string,
): Promise<void> {
  const ownerEmail = getCanonicalPlatformPoolOwnerEmail();
  const gw = await prisma.gatewayUser.findUnique({
    where: { id: gatewayUserId },
    select: { email: true },
  });
  if (gw?.email.trim().toLowerCase() !== ownerEmail) return;

  const platformKey = await findPlatformAdminApiKey();
  if (!platformKey) return;

  const activeIds = (
    await prisma.gatewayVendorCredential.findMany({
      where: { userId: gatewayUserId, active: true },
      select: { id: true },
    })
  ).map((c) => c.id);

  await prisma.gatewayApiKeyCredential.deleteMany({ where: { apiKeyId: platformKey.id } });
  if (activeIds.length > 0) {
    await prisma.gatewayApiKeyCredential.createMany({
      data: activeIds.map((credentialId) => ({ apiKeyId: platformKey.id, credentialId })),
      skipDuplicates: true,
    });
  }

  try {
    await rebindManagedKeysToPlatformPool();
  } catch {
    // 凭证池为空（例如删光）时不阻断
  }
}

/** 将 Platform Admin Key 的凭证绑定同步到所有平台托管 sk-gw */
export async function rebindManagedKeysToPlatformPool(): Promise<{ updated: number }> {
  const credentialIds = await resolvePlatformVendorCredentialIds();
  if (credentialIds.length === 0) {
    throw new Error("平台凭证池为空：请先在 Gateway 配置 Platform Admin Key 与厂商凭证");
  }

  const managedKeys = await prisma.gatewayApiKey.findMany({
    where: { managedByPlatform: true, revokedAt: null },
    select: { id: true },
  });

  for (const key of managedKeys) {
    await prisma.gatewayApiKeyCredential.deleteMany({ where: { apiKeyId: key.id } });
    await prisma.gatewayApiKeyCredential.createMany({
      data: credentialIds.map((credentialId) => ({ apiKeyId: key.id, credentialId })),
      skipDuplicates: true,
    });
  }

  return { updated: managedKeys.length };
}
