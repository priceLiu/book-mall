/**
 * 试点账号：从 .env.local 导入 Gateway 厂商凭证（含火山方舟 VOLCENGINE）→ Platform Admin + Personal sk-gw → Book 关联 Personal。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/seed-pilot-gateway.ts
 *
 * 输出 sk-gw 明文仅用于本地调试；生产勿记录日志。
 */
import type { GatewayProviderKind } from "@prisma/client";

import {
  getGatewayLinkStatusForUser,
  linkGatewayApiKeyForUser,
} from "../lib/gateway/book-gateway-link";
import { createGatewayApiKey } from "../lib/gateway/api-key-service";
import { createGatewayCredential } from "../lib/gateway/credential-service";
import {
  isLegacyPlatformKeyName,
  PERSONAL_KEY_DEFAULT_NAME,
  PLATFORM_ADMIN_KEY_NAME,
} from "../lib/gateway/key-scope";
import { prisma } from "../lib/prisma";
import {
  findGatewayUserByBookUserId,
  syncGatewayUserFromBookUser,
} from "../lib/gateway/sync-user";

const PILOT_EMAIL = "13808816802@126.com";

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
      console.log(`[patch] ${spec.alias} baseUrl → ${targetBase}`);
    } else {
      console.log(`[skip] ${spec.alias} (${spec.kind}) 凭证已存在`);
    }
    return existing.id;
  }

  const apiKey = process.env[spec.env]?.trim();
  if (!apiKey) {
    console.warn(`[skip] ${spec.env} 未配置，跳过 ${spec.alias}`);
    return null;
  }

  const row = await createGatewayCredential({
    userId: gatewayUserId,
    alias: spec.alias,
    providerKind: spec.kind,
    apiKey,
    baseUrl: spec.baseUrl ?? null,
  });
  console.log(`[ok] Gateway 凭证 ${spec.alias} (${spec.kind}) 已创建`);
  return row.id;
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
      console.log("[ok] 已将历史 Key 升级为 Platform Admin");
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
    console.log("[ok] 新建 Platform Admin API Key");
  } else {
    await prisma.gatewayApiKeyCredential.deleteMany({
      where: { apiKeyId: platformKey.id },
    });
    if (credentialIds.length > 0) {
      await prisma.gatewayApiKeyCredential.createMany({
        data: credentialIds.map((credentialId) => ({
          apiKeyId: platformKey!.id,
          credentialId,
        })),
        skipDuplicates: true,
      });
    }
    console.log(`[ok] Platform Admin 已绑定 ${credentialIds.length} 条凭证`);
  }

  return { apiKeyId: platformKey.id, rawKey };
}

async function ensurePersonalKey(
  gatewayUserId: string,
  credentialIds: string[],
): Promise<{ apiKeyId: string; rawKey: string | null }> {
  let personalKey = await prisma.gatewayApiKey.findFirst({
    where: { userId: gatewayUserId, scope: "PERSONAL", revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  let rawKey: string | null = null;

  if (!personalKey) {
    const created = await createGatewayApiKey({
      userId: gatewayUserId,
      name: PERSONAL_KEY_DEFAULT_NAME,
      scope: "PERSONAL",
      credentialIds,
    });
    personalKey = created.apiKey;
    rawKey = created.rawKey;
    console.log("[ok] 新建 Personal Key（Book 关联用）");
  } else {
    await prisma.gatewayApiKeyCredential.deleteMany({
      where: { apiKeyId: personalKey.id },
    });
    if (credentialIds.length > 0) {
      await prisma.gatewayApiKeyCredential.createMany({
        data: credentialIds.map((credentialId) => ({
          apiKeyId: personalKey!.id,
          credentialId,
        })),
        skipDuplicates: true,
      });
    }
    console.log(`[ok] Personal Key 已绑定 ${credentialIds.length} 条凭证`);
  }

  return { apiKeyId: personalKey.id, rawKey };
}

async function main() {
  const email = PILOT_EMAIL.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`用户不存在: ${email}，请先在 /register 注册`);
    process.exit(1);
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  console.log(`[ok] ${email} → ADMIN（Book 管理员，Gateway 可同时持有 Platform + Personal Key）`);

  await syncGatewayUserFromBookUser({
    bookUserId: user.id,
    email: user.email!,
    name: user.name,
  });
  const gwUser = await findGatewayUserByBookUserId(user.id);
  if (!gwUser) {
    throw new Error("GatewayUser 同步失败");
  }
  console.log("[ok] GatewayUser 已同步");

  const credentialIds: string[] = [];
  for (const spec of CREDENTIALS) {
    const id = await ensureCredential(gwUser.id, spec);
    if (id) credentialIds.push(id);
  }

  if (credentialIds.length === 0) {
    console.error("未创建任何 Gateway 凭证，请配置 KIE_API_KEY 等环境变量");
    process.exit(1);
  }

  const platform = await ensurePlatformAdminKey(gwUser.id, credentialIds);
  const personal = await ensurePersonalKey(gwUser.id, credentialIds);

  const statusBefore = await getGatewayLinkStatusForUser(user.id);
  const shouldLinkPersonal =
    !statusBefore.linked ||
    statusBefore.gatewayApiKeyId === platform.apiKeyId ||
    isLegacyPlatformKeyName(statusBefore.keyName ?? "");

  if (shouldLinkPersonal && personal.rawKey) {
    await linkGatewayApiKeyForUser(user.id, personal.rawKey);
    console.log("[ok] Book 用户已关联 Personal Key");
  } else if (statusBefore.linked && statusBefore.gatewayApiKeyId === personal.apiKeyId) {
    console.log("[ok] Book 用户已关联 Personal Key（保留现有关联）");
  } else if (statusBefore.linked) {
    console.log(
      "[ok] Book 用户已关联其他 Personal Key（保留现有关联）",
    );
  } else if (personal.rawKey) {
    await linkGatewayApiKeyForUser(user.id, personal.rawKey);
    console.log("[ok] Book 用户已关联 Personal Key");
  } else {
    console.warn(
      "[warn] Personal Key 已存在但无法自动关联，请在 Book 个人中心粘贴 Personal sk-gw",
    );
  }

  const status = await getGatewayLinkStatusForUser(user.id);
  console.log(
    JSON.stringify(
      {
        linked: status.linked,
        keyName: status.keyName,
        keyPrefix: status.keyPrefix,
        boundKinds: status.boundKinds,
        platformAdminKeyId: platform.apiKeyId,
        personalKeyId: personal.apiKeyId,
        credentialCount: credentialIds.length,
        ...(personal.rawKey ? { personalSkGw: personal.rawKey } : {}),
        ...(platform.rawKey ? { platformAdminSkGw: platform.rawKey } : {}),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
