/**
 * 平台凭证池 canonical 在 PLATFORM_POOL_OWNER 名下；其它 Book 管理员 Gateway 账号持有副本（复制，非迁移）。
 */
import type { GatewayProviderKind } from "@prisma/client";

import { decryptApiKey } from "@/lib/canvas/secret";
import { createGatewayApiKey } from "@/lib/gateway/api-key-service";
import { createGatewayCredential, updateGatewayCredential } from "@/lib/gateway/credential-service";
import { PLATFORM_ADMIN_KEY_NAME } from "@/lib/gateway/key-scope";
import { prisma } from "@/lib/prisma";
import {
  findGatewayUserByBookUserId,
  syncGatewayUserFromBookUser,
} from "@/lib/gateway/sync-user";

/** 平台代付用户实际使用的凭证池归属（默认试点账号） */
export function getCanonicalPlatformPoolOwnerEmail(): string {
  return (
    process.env.PLATFORM_POOL_OWNER_EMAIL?.trim().toLowerCase() ||
    "13808816802@126.com"
  );
}

/** 可在 Gateway 控制台管理厂商 Key 的 Book 管理员邮箱（复制 canonical 凭证到此） */
export function getPlatformGatewayAdminEmails(): string[] {
  const raw = process.env.PLATFORM_GATEWAY_ADMIN_EMAILS?.trim();
  const defaults = ["13808816802@126.com", "admin@126.com"];
  if (!raw) return defaults.map((e) => e.toLowerCase());
  return [...new Set([...raw.split(/[,;\s]+/).map((s) => s.trim().toLowerCase()), ...defaults])].filter(
    Boolean,
  );
}

export async function findCanonicalPlatformAdminApiKey() {
  const ownerEmail = getCanonicalPlatformPoolOwnerEmail();
  const gwUser = await prisma.gatewayUser.findUnique({
    where: { email: ownerEmail },
    select: { id: true, email: true },
  });
  if (!gwUser) return null;

  const envKeyId = process.env.PLATFORM_GATEWAY_API_KEY_ID?.trim();
  if (envKeyId) {
    const keyed = await prisma.gatewayApiKey.findFirst({
      where: { id: envKeyId, userId: gwUser.id, scope: "PLATFORM", revokedAt: null },
      include: {
        bindings: {
          include: {
            credential: true,
          },
        },
        user: { select: { email: true, id: true } },
      },
    });
    if (keyed) return keyed;
  }

  return prisma.gatewayApiKey.findFirst({
    where: { userId: gwUser.id, scope: "PLATFORM", revokedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      bindings: {
        include: {
          credential: true,
        },
      },
      user: { select: { email: true, id: true } },
    },
  });
}

export type CopyPlatformCredentialsResult = {
  canonicalOwnerEmail: string;
  targetEmail: string;
  copied: number;
  platformAdminKeyId: string;
};

/** 将 canonical 凭证池复制到目标 Book 用户的 Gateway 账号（Platform Admin Key 绑定同步副本） */
export async function copyCanonicalCredentialsToBookUser(
  targetBookEmail: string,
): Promise<CopyPlatformCredentialsResult> {
  const canonical = await findCanonicalPlatformAdminApiKey();
  if (!canonical || canonical.bindings.length === 0) {
    throw new Error(
      `canonical 凭证池为空：请先在 ${getCanonicalPlatformPoolOwnerEmail()} 的 Gateway 配置 Platform Admin Key`,
    );
  }

  const targetEmail = targetBookEmail.trim().toLowerCase();
  const bookUser = await prisma.user.findUnique({
    where: { email: targetEmail },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!bookUser?.email) throw new Error(`Book 用户不存在: ${targetEmail}`);

  await syncGatewayUserFromBookUser({
    bookUserId: bookUser.id,
    email: bookUser.email,
    name: bookUser.name,
  });
  const targetGw = await findGatewayUserByBookUserId(bookUser.id);
  if (!targetGw) throw new Error("GatewayUser 同步失败");

  const copiedIds: string[] = [];

  for (const binding of canonical.bindings) {
    const src = binding.credential;
    if (!src.active) continue;

    let plain: string;
    try {
      plain = decryptApiKey(src.apiKeyEncrypted);
    } catch {
      continue;
    }

    const existing = await prisma.gatewayVendorCredential.findFirst({
      where: {
        userId: targetGw.id,
        providerKind: src.providerKind,
        alias: src.alias,
      },
    });

    if (existing) {
      await updateGatewayCredential(targetGw.id, existing.id, {
        apiKey: plain,
        baseUrl: src.baseUrl,
        active: src.active,
        channel: src.channel ?? "platform-pool-copy",
        isDefaultForProvider: src.isDefaultForProvider,
      });
      copiedIds.push(existing.id);
    } else {
      const row = await createGatewayCredential({
        userId: targetGw.id,
        alias: src.alias,
        providerKind: src.providerKind as GatewayProviderKind,
        apiKey: plain,
        baseUrl: src.baseUrl,
        channel: src.channel ?? "platform-pool-copy",
        isDefaultForProvider: src.isDefaultForProvider,
      });
      copiedIds.push(row.id);
    }
  }

  if (copiedIds.length === 0) {
    throw new Error("未能复制任何凭证（解密失败或 canonical 为空）");
  }

  let platformKey = await prisma.gatewayApiKey.findFirst({
    where: { userId: targetGw.id, scope: "PLATFORM", revokedAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (!platformKey) {
    const created = await createGatewayApiKey({
      userId: targetGw.id,
      name: PLATFORM_ADMIN_KEY_NAME,
      scope: "PLATFORM",
      credentialIds: copiedIds,
    });
    platformKey = created.apiKey;
  } else {
    await prisma.gatewayApiKeyCredential.deleteMany({ where: { apiKeyId: platformKey.id } });
    await prisma.gatewayApiKeyCredential.createMany({
      data: copiedIds.map((credentialId) => ({ apiKeyId: platformKey!.id, credentialId })),
      skipDuplicates: true,
    });
  }

  return {
    canonicalOwnerEmail: getCanonicalPlatformPoolOwnerEmail(),
    targetEmail,
    copied: copiedIds.length,
    platformAdminKeyId: platformKey.id,
  };
}

/** 复制 canonical 到所有平台 Gateway 管理员（跳过 canonical 本人） */
export async function copyCanonicalCredentialsToPlatformAdmins(): Promise<CopyPlatformCredentialsResult[]> {
  const owner = getCanonicalPlatformPoolOwnerEmail();
  const emails = getPlatformGatewayAdminEmails().filter((e) => e !== owner);
  const results: CopyPlatformCredentialsResult[] = [];
  for (const email of emails) {
    results.push(await copyCanonicalCredentialsToBookUser(email));
  }
  return results;
}
