/**
 * 电商图像处理 · Doubao Seedream 5.0 Lite · 火山方舟凭证（平台代付）
 *
 * 用法（勿将 ARK_API_KEY 写入仓库）：
 *   cd book-mall
 *   ARK_API_KEY='ark-...' pnpm exec dotenv -e .env.local -- tsx scripts/setup-seedream-5-volcengine-gateway.ts
 *
 * 可选指定 canonical 平台账号邮箱（默认 PLATFORM_POOL_OWNER_EMAIL / 首个 ADMIN）：
 *   ARK_API_KEY='ark-...' pnpm exec dotenv -e .env.local -- tsx scripts/setup-seedream-5-volcengine-gateway.ts 13808816802@126.com
 */
import { encryptApiKey } from "../lib/canvas/secret";
import {
  createGatewayCredential,
  getDecryptedCredentialApiKey,
} from "../lib/gateway/credential-service";
import { syncPersonalGatewayApiKeyBindings } from "../lib/gateway/api-key-service";
import {
  rebindManagedKeysToPlatformPool,
  syncCanonicalPlatformAdminKeyBindings,
} from "../lib/gateway/platform-credential-pool";
import { buildVolcengineCredentialStorage } from "../lib/gateway/volcengine-gateway-credential";
import { getCanonicalPlatformPoolOwnerEmail } from "../lib/gateway/platform-credential-copy";
import { prisma } from "../lib/prisma";
import {
  findGatewayUserByBookUserId,
  syncGatewayUserFromBookUser,
} from "../lib/gateway/sync-user";

const ALIAS = "火山方舟";
const BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

async function main() {
  const apiKey =
    process.env.ARK_API_KEY?.trim() ||
    process.env.VOLCENGINE_API_KEY?.trim() ||
    "";
  if (!apiKey) {
    console.error("请设置 ARK_API_KEY 或 VOLCENGINE_API_KEY（环境变量，勿提交 git）");
    process.exit(1);
  }

  const emailArg = process.argv[2]?.trim() || getCanonicalPlatformPoolOwnerEmail();
  const bookUser = await prisma.user.findFirst({
    where: { email: emailArg },
    select: { id: true, email: true, name: true },
  });
  if (!bookUser) {
    console.error(`未找到 Book 用户: ${emailArg}`);
    process.exit(1);
  }

  await syncGatewayUserFromBookUser({
    bookUserId: bookUser.id,
    email: bookUser.email,
    name: bookUser.name,
  });
  const gwUser = await findGatewayUserByBookUserId(bookUser.id);
  if (!gwUser) {
    console.error("Gateway 用户同步失败");
    process.exit(1);
  }

  let volcCreds = await prisma.gatewayVendorCredential.findMany({
    where: { userId: gwUser.id, providerKind: "VOLCENGINE" },
    orderBy: [{ isDefaultForProvider: "desc" }, { createdAt: "asc" }],
    select: { id: true, alias: true, isDefaultForProvider: true },
  });

  if (volcCreds.length === 0) {
    const created = await createGatewayCredential({
      userId: gwUser.id,
      alias: ALIAS,
      providerKind: "VOLCENGINE",
      apiKey,
      baseUrl: BASE_URL,
      channel: "platform-pool",
      isDefaultForProvider: true,
    });
    volcCreds = [
      {
        id: created.id,
        alias: created.alias,
        isDefaultForProvider: created.isDefaultForProvider,
      },
    ];
    console.log(`[ok] 已创建 ${ALIAS} 凭证 id=${created.id}`);
  }

  let defaultId = volcCreds.find((c) => c.isDefaultForProvider)?.id ?? volcCreds[0]!.id;

  for (const cred of volcCreds) {
    const existing = await getDecryptedCredentialApiKey(cred.id);
    const blob = buildVolcengineCredentialStorage({
      apiKey,
      existingRaw: existing?.apiKey,
    });
    await prisma.gatewayVendorCredential.update({
      where: { id: cred.id },
      data: {
        apiKeyEncrypted: encryptApiKey(blob),
        active: true,
        baseUrl: BASE_URL,
        isDefaultForProvider: cred.id === defaultId,
      },
    });
    console.log(`[ok] 已更新 VOLCENGINE 凭证 alias=${cred.alias} id=${cred.id}`);
  }

  await prisma.gatewayVendorCredential.updateMany({
    where: {
      userId: gwUser.id,
      providerKind: "VOLCENGINE",
      isDefaultForProvider: true,
      id: { not: defaultId },
    },
    data: { isDefaultForProvider: false },
  });

  await syncPersonalGatewayApiKeyBindings(gwUser.id);
  await syncCanonicalPlatformAdminKeyBindings(gwUser.id);
  const { updated } = await rebindManagedKeysToPlatformPool();
  console.log(`[ok] 已更新 ${bookUser.email} · 全部 ${volcCreds.length} 条火山凭证（Seedream / 图像编辑）`);
  console.log(`[ok] 平台托管 sk-gw 凭证绑定已刷新: ${updated} 把`);
  console.log("模型: doubao-seedream-5-0-260128 (canonical: doubao-seedream-5-0-lite)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
