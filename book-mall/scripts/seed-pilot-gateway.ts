/**
 * 试点账号：从 .env.local 导入 Gateway 五类厂商凭证 → 绑定 sk-gw → Book 关联。
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
];

async function ensureCredential(
  gatewayUserId: string,
  spec: (typeof CREDENTIALS)[number],
): Promise<string | null> {
  const existing = await prisma.gatewayVendorCredential.findFirst({
    where: { userId: gatewayUserId, providerKind: spec.kind, alias: spec.alias },
    select: { id: true },
  });
  if (existing) {
    console.log(`[skip] ${spec.alias} (${spec.kind}) 凭证已存在`);
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

async function syncApiKeyBindings(
  gatewayUserId: string,
  credentialIds: string[],
): Promise<{ apiKeyId: string; rawKey: string | null }> {
  let apiKey = await prisma.gatewayApiKey.findFirst({
    where: { userId: gatewayUserId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  let rawKey: string | null = null;

  if (!apiKey) {
    const created = await createGatewayApiKey({
      userId: gatewayUserId,
      name: "全站 Gateway",
      credentialIds,
    });
    apiKey = created.apiKey;
    rawKey = created.rawKey;
    console.log("[ok] 新建 Gateway API Key");
  } else {
    await prisma.gatewayApiKeyCredential.deleteMany({
      where: { apiKeyId: apiKey.id },
    });
    if (credentialIds.length > 0) {
      await prisma.gatewayApiKeyCredential.createMany({
        data: credentialIds.map((credentialId) => ({
          apiKeyId: apiKey!.id,
          credentialId,
        })),
        skipDuplicates: true,
      });
    }
    console.log(`[ok] 已同步 ${credentialIds.length} 条凭证到现有 API Key`);
  }

  return { apiKeyId: apiKey.id, rawKey };
}

async function main() {
  const email = PILOT_EMAIL.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`用户不存在: ${email}，请先在 /register 注册`);
    process.exit(1);
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  console.log(`[ok] ${email} → ADMIN`);

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

  const { rawKey } = await syncApiKeyBindings(gwUser.id, credentialIds);

  const statusBefore = await getGatewayLinkStatusForUser(user.id);
  if (!statusBefore.linked && rawKey) {
    await linkGatewayApiKeyForUser(user.id, rawKey);
    console.log("[ok] Book 用户已关联 Gateway API Key");
  } else if (statusBefore.linked) {
    console.log("[ok] Book 用户已关联 Gateway API Key（保留现有关联）");
  } else {
    console.warn(
      "[warn] 无法自动关联：已有 API Key 但 Book 未关联，请在个人中心粘贴 sk-gw",
    );
  }

  const status = await getGatewayLinkStatusForUser(user.id);
  console.log(
    JSON.stringify(
      {
        linked: status.linked,
        keyPrefix: status.keyPrefix,
        boundKinds: status.boundKinds,
        credentialCount: credentialIds.length,
        ...(rawKey ? { skGw: rawKey } : {}),
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
