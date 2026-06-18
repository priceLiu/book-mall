/**
 * 分镜视频 1.0 · 火山方舟 Gateway 凭证与 sk-gw 初始化
 *
 * 用法（勿将 ARK_API_KEY 写入仓库）：
 *   cd book-mall
 *   ARK_API_KEY='ark-...' pnpm exec dotenv -e .env.local -- tsx scripts/setup-sbv1-volcengine-gateway.ts [book-user-email]
 *
 * 或于 .env.local 配置 VOLCENGINE_API_KEY / ARK_API_KEY 后：
 *   pnpm exec dotenv -e .env.local -- tsx scripts/setup-sbv1-volcengine-gateway.ts
 *
 * 私域人像 IAM（Access Key / Secret）请在 Gateway 控制台「火山方舟」凭证中填写，勿写入 .env。
 */
import {
  getGatewayLinkStatusForUser,
  linkGatewayApiKeyForUser,
} from "../lib/gateway/book-gateway-link";
import { createGatewayApiKey } from "../lib/gateway/api-key-service";
import {
  createGatewayCredential,
  getDecryptedCredentialApiKey,
  updateGatewayCredential,
} from "../lib/gateway/credential-service";
import { buildVolcengineCredentialStorage } from "../lib/gateway/volcengine-gateway-credential";
import { PERSONAL_KEY_DEFAULT_NAME } from "../lib/gateway/key-scope";
import { prisma } from "../lib/prisma";
import {
  findGatewayUserByBookUserId,
  syncGatewayUserFromBookUser,
} from "../lib/gateway/sync-user";

const SBV1_KEY_NAME = "分镜视频 1.0 · Personal";

async function main() {
  const emailArg = process.argv[2]?.trim();
  const apiKey =
    process.env.ARK_API_KEY?.trim() ||
    process.env.VOLCENGINE_API_KEY?.trim() ||
    "";

  if (!apiKey) {
    console.error(
      "请设置 ARK_API_KEY 或 VOLCENGINE_API_KEY（环境变量，勿提交 git）",
    );
    process.exit(1);
  }

  const apiKeyBlob = buildVolcengineCredentialStorage({ apiKey });

  const bookUser = emailArg
    ? await prisma.user.findFirst({
        where: { email: emailArg },
        select: { id: true, email: true, name: true },
      })
    : await prisma.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true, name: true },
      });

  if (!bookUser) {
    console.error("未找到 Book 用户，请传入 email 参数");
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

  let credential = await prisma.gatewayVendorCredential.findFirst({
    where: {
      userId: gwUser.id,
      providerKind: "VOLCENGINE",
      alias: "火山方舟 · 分镜视频1.0",
    },
    select: { id: true },
  });

  if (!credential) {
    const row = await createGatewayCredential({
      userId: gwUser.id,
      alias: "火山方舟 · 分镜视频1.0",
      providerKind: "VOLCENGINE",
      apiKey: apiKeyBlob,
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    });
    credential = { id: row.id };
    console.log("[ok] VOLCENGINE 凭证已创建（分镜视频 1.0 专用别名）");
  } else {
    const existing = await getDecryptedCredentialApiKey(credential.id);
    await updateGatewayCredential(gwUser.id, credential.id, {
      apiKey: buildVolcengineCredentialStorage({
        apiKey,
        existingRaw: existing?.apiKey,
      }),
      active: true,
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    });
    console.log("[ok] VOLCENGINE 凭证 Key 已更新（分镜视频 1.0 专用别名）");
  }

  // 同步平台默认别名「火山方舟」（Personal / Platform Admin 绑定池）
  const platformCred = await prisma.gatewayVendorCredential.findFirst({
    where: {
      userId: gwUser.id,
      providerKind: "VOLCENGINE",
      alias: "火山方舟",
    },
    select: { id: true },
  });
  if (platformCred) {
    const existingPlatform = await getDecryptedCredentialApiKey(platformCred.id);
    await updateGatewayCredential(gwUser.id, platformCred.id, {
      apiKey: buildVolcengineCredentialStorage({
        apiKey,
        existingRaw: existingPlatform?.apiKey,
      }),
      active: true,
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    });
    console.log("[ok] 平台别名「火山方舟」凭证 ark Key 已同步");
  }

  let apiKeyRow = await prisma.gatewayApiKey.findFirst({
    where: {
      userId: gwUser.id,
      name: SBV1_KEY_NAME,
      revokedAt: null,
    },
    select: { id: true },
  });

  let rawKey: string | null = null;
  if (!apiKeyRow) {
    const created = await createGatewayApiKey({
      userId: gwUser.id,
      name: SBV1_KEY_NAME,
      scope: "PERSONAL",
      credentialIds: [credential.id],
    });
    apiKeyRow = { id: created.apiKey.id };
    rawKey = created.rawKey;
    console.log("[ok] Personal sk-gw 已创建:", SBV1_KEY_NAME);
  } else {
    console.log("[skip] sk-gw 已存在:", SBV1_KEY_NAME);
  }

  const link = await getGatewayLinkStatusForUser(bookUser.id);
  if (!link.linked) {
    if (rawKey) {
      await linkGatewayApiKeyForUser(bookUser.id, apiKeyRow!.id);
      console.log("[ok] Book 账号已关联 Personal sk-gw");
    } else {
      console.warn(
        "[warn] 请在 Book 个人中心关联 Gateway Key，或删除旧 Key 后重跑以获取明文 sk-gw",
      );
    }
  } else {
    console.log("[skip] Book 已关联 Gateway Key");
  }

  if (rawKey) {
    console.log("\n--- 分镜视频 1.0 · sk-gw（仅本次输出，勿提交）---");
    console.log(rawKey);
    console.log("---\n");
  }

  console.log("Book 用户:", bookUser.email);
  console.log("下一步：");
  console.log("  1. Gateway 控制台编辑「火山方舟」凭证：填入 ark Key + IAM Access Key / Secret（人像入库）");
  console.log("  2. 火山控制台开通 doubao-seedance-2.0 / 录入真人人像库");
  console.log("  3. canvas-web 新建「分镜视频 1.0」项目测试生成与私域人像入库");
  console.log("  4. Gateway 日志 model=portrait:virtual 可查看入库原图缩略图");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
