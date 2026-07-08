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
import {
  getDecryptedCredentialApiKey,
  updateGatewayCredential,
} from "../lib/gateway/credential-service";
import { buildVolcengineCredentialStorage } from "../lib/gateway/volcengine-gateway-credential";
import { getCanonicalPlatformPoolOwnerEmail } from "../lib/gateway/platform-credential-copy";
import { rebindManagedKeysToPlatformPool } from "../lib/gateway/platform-credential-pool";
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

  const defaultCred = await prisma.gatewayVendorCredential.findFirst({
    where: {
      userId: gwUser.id,
      providerKind: "VOLCENGINE",
      alias: ALIAS,
      isDefaultForProvider: true,
    },
    select: { id: true },
  });

  const anyVolc = defaultCred
    ? defaultCred
    : await prisma.gatewayVendorCredential.findFirst({
        where: {
          userId: gwUser.id,
          providerKind: "VOLCENGINE",
          alias: ALIAS,
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

  if (!anyVolc) {
    console.error(`未找到「${ALIAS}」凭证，请先在 Gateway 模型管理页创建 VOLCENGINE 凭证`);
    process.exit(1);
  }

  const existing = await getDecryptedCredentialApiKey(anyVolc.id);
  const blob = buildVolcengineCredentialStorage({
    apiKey,
    existingRaw: existing?.apiKey,
  });

  await updateGatewayCredential(gwUser.id, anyVolc.id, {
    apiKey: blob,
    active: true,
    baseUrl: BASE_URL,
    isDefaultForProvider: true,
  });

  const { updated } = await rebindManagedKeysToPlatformPool();
  console.log(`[ok] 已更新 ${bookUser.email} · ${ALIAS} 默认凭证（Seedream 5.0 / 图像编辑）`);
  console.log(`[ok] 平台托管 sk-gw 凭证绑定已刷新: ${updated} 把`);
  console.log("模型: doubao-seedream-5-0-260128 (canonical: doubao-seedream-5-0-lite)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
