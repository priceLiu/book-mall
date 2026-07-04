/**
 * 从 .env.local 厂商 Key 导入 Gateway 凭证，并维护 Platform Admin + Personal Key 绑定。
 * 供 seed 脚本与 Book 管理后台「同步凭证池」共用。
 */
import type { GatewayProviderKind } from "@prisma/client";

import {
  getGatewayLinkStatusForUser,
  linkGatewayApiKeyForUser,
} from "@/lib/gateway/book-gateway-link";
import { createGatewayApiKey } from "@/lib/gateway/api-key-service";
import {
  createGatewayCredential,
  getDecryptedCredentialApiKey,
  updateGatewayCredential,
} from "@/lib/gateway/credential-service";
import {
  buildVolcengineCredentialStorageFromEnv,
} from "@/lib/gateway/volcengine-gateway-credential";
import {
  isLegacyPlatformKeyName,
  PERSONAL_KEY_DEFAULT_NAME,
  PLATFORM_ADMIN_KEY_NAME,
} from "@/lib/gateway/key-scope";
import { rebindManagedKeysToPlatformPool } from "@/lib/gateway/platform-credential-pool";
import { prisma } from "@/lib/prisma";
import {
  findGatewayUserByBookUserId,
  syncGatewayUserFromBookUser,
} from "@/lib/gateway/sync-user";

const CREDENTIALS: Array<{
  kind: GatewayProviderKind;
  alias: string;
  env: string;
  baseUrl?: string;
}> = [
  { kind: "KIE", alias: "KIE", env: "KIE_API_KEY" },
  {
    kind: "DEEPSEEK",
    alias: "DeepSeek",
    env: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com/v1",
  },
  {
    kind: "BAILIAN",
    alias: "百炼",
    env: "DASHSCOPE_API_KEY",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  {
    kind: "DASHSCOPE",
    alias: "DashScope",
    env: "DASHSCOPE_API_KEY",
    baseUrl: "https://dashscope.aliyuncs.com",
  },
  {
    kind: "HUNYUAN",
    alias: "混元 3D",
    env: "HUNYUAN_3D_API_KEY",
    baseUrl: "https://api.ai3d.cloud.tencent.com",
  },
  {
    kind: "VOLCENGINE",
    alias: "火山方舟",
    env: "VOLCENGINE_API_KEY",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  },
  {
    kind: "MINIMAX",
    alias: "MiniMax",
    env: "MINIMAX_API_KEY",
    baseUrl: "https://api.minimaxi.com",
  },
  {
    kind: "WORLDLABS",
    alias: "World Labs",
    env: "WORLDLABS_API_KEY",
    baseUrl: "https://api.worldlabs.ai",
  },
];

async function ensureCredential(
  gatewayUserId: string,
  spec: (typeof CREDENTIALS)[number],
): Promise<string | null> {
  const existing = await prisma.gatewayVendorCredential.findFirst({
    where: { userId: gatewayUserId, providerKind: spec.kind, alias: spec.alias },
    select: { id: true, baseUrl: true },
  });
  if (existing) {
    const targetBase = spec.baseUrl?.trim() || null;
    if (targetBase && existing.baseUrl !== targetBase) {
      await prisma.gatewayVendorCredential.update({
        where: { id: existing.id },
        data: { baseUrl: targetBase },
      });
    }
    if (spec.kind === "VOLCENGINE") {
      const decrypted = await getDecryptedCredentialApiKey(existing.id);
      try {
        const apiKey = buildVolcengineCredentialStorageFromEnv(decrypted?.apiKey);
        await updateGatewayCredential(gatewayUserId, existing.id, {
          apiKey,
          active: true,
          ...(targetBase ? { baseUrl: targetBase } : {}),
        });
      } catch {
        /* env 未配齐时保留已有凭证 */
      }
    }
    const envKey = process.env[spec.env]?.trim();
    if (envKey && spec.kind === "MINIMAX") {
      await updateGatewayCredential(gatewayUserId, existing.id, {
        apiKey: envKey,
        active: true,
        ...(targetBase ? { baseUrl: targetBase } : {}),
      });
    }
    if (envKey && spec.kind === "WORLDLABS") {
      await updateGatewayCredential(gatewayUserId, existing.id, {
        apiKey: envKey,
        active: true,
        ...(targetBase ? { baseUrl: targetBase } : {}),
      });
    }
    return existing.id;
  }

  const apiKey =
    spec.kind === "VOLCENGINE"
      ? buildVolcengineCredentialStorageFromEnv()
      : process.env[spec.env]?.trim();
  if (!apiKey) return null;

  const created = await createGatewayCredential({
    userId: gatewayUserId,
    alias: spec.alias,
    providerKind: spec.kind,
    apiKey,
    baseUrl: spec.baseUrl,
    channel: "platform-pool",
    isDefaultForProvider: true,
  });
  return created.id;
}

async function ensurePlatformAdminKey(
  gatewayUserId: string,
  credentialIds: string[],
): Promise<{ apiKeyId: string; rawKey: string | null }> {
  let platformKey = await prisma.gatewayApiKey.findFirst({
    where: { userId: gatewayUserId, scope: "PLATFORM", revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!platformKey) {
    const legacy = await prisma.gatewayApiKey.findFirst({
      where: { userId: gatewayUserId, revokedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (legacy && isLegacyPlatformKeyName(legacy.name)) {
      platformKey = await prisma.gatewayApiKey.update({
        where: { id: legacy.id },
        data: { name: PLATFORM_ADMIN_KEY_NAME, scope: "PLATFORM" },
      });
    }
  } else if (platformKey.name !== PLATFORM_ADMIN_KEY_NAME) {
    platformKey = await prisma.gatewayApiKey.update({
      where: { id: platformKey.id },
      data: { name: PLATFORM_ADMIN_KEY_NAME },
    });
  }

  let rawKey: string | null = null;

  if (!platformKey) {
    const created = await createGatewayApiKey({
      userId: gatewayUserId,
      name: PLATFORM_ADMIN_KEY_NAME,
      scope: "PLATFORM",
      credentialIds,
    });
    platformKey = created.apiKey;
    rawKey = created.rawKey;
  } else {
    await prisma.gatewayApiKeyCredential.deleteMany({ where: { apiKeyId: platformKey.id } });
    if (credentialIds.length > 0) {
      await prisma.gatewayApiKeyCredential.createMany({
        data: credentialIds.map((credentialId) => ({
          apiKeyId: platformKey!.id,
          credentialId,
        })),
        skipDuplicates: true,
      });
    }
  }

  return { apiKeyId: platformKey.id, rawKey };
}

export type SyncPlatformCredentialPoolResult = {
  bookUserId: string;
  email: string;
  credentialCount: number;
  platformAdminKeyId: string;
  managedKeysUpdated: number;
  linkedPersonal: boolean;
};

/** 为指定 Book 管理员同步 Gateway 凭证池 + Platform Admin Key，并刷新托管 sk-gw 绑定 */
export async function syncPlatformCredentialPoolForBookUser(
  bookUserId: string,
): Promise<SyncPlatformCredentialPoolResult> {
  const user = await prisma.user.findUnique({
    where: { id: bookUserId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user?.email) throw new Error("用户不存在或缺少邮箱");

  await syncGatewayUserFromBookUser({
    bookUserId: user.id,
    email: user.email,
    name: user.name,
  });
  const gwUser = await findGatewayUserByBookUserId(user.id);
  if (!gwUser) throw new Error("GatewayUser 同步失败");

  const credentialIds: string[] = [];
  for (const spec of CREDENTIALS) {
    const id = await ensureCredential(gwUser.id, spec);
    if (id) credentialIds.push(id);
  }
  if (credentialIds.length === 0) {
    throw new Error("未导入任何凭证：请在 .env.local 配置 KIE_API_KEY、DASHSCOPE_API_KEY 等");
  }

  const platform = await ensurePlatformAdminKey(gwUser.id, credentialIds);
  const { updated: managedKeysUpdated } = await rebindManagedKeysToPlatformPool();

  let linkedPersonal = false;
  if (user.role === "ADMIN") {
    const personal = await prisma.gatewayApiKey.findFirst({
      where: { userId: gwUser.id, scope: "PERSONAL", revokedAt: null, managedByPlatform: false },
      orderBy: { createdAt: "desc" },
    });
    if (personal) {
      await prisma.gatewayApiKeyCredential.deleteMany({ where: { apiKeyId: personal.id } });
      await prisma.gatewayApiKeyCredential.createMany({
        data: credentialIds.map((credentialId) => ({ apiKeyId: personal.id, credentialId })),
        skipDuplicates: true,
      });
      const status = await getGatewayLinkStatusForUser(user.id);
      if (!status.linked || status.gatewayApiKeyId !== personal.id) {
        linkedPersonal = false;
      } else {
        linkedPersonal = true;
      }
    }
  }

  return {
    bookUserId: user.id,
    email: user.email,
    credentialCount: credentialIds.length,
    platformAdminKeyId: platform.apiKeyId,
    managedKeysUpdated,
    linkedPersonal,
  };
}
