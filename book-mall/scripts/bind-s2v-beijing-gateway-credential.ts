/**
 * 数字人 S2V · 华北2（北京）业务空间 API Key 绑定到 Gateway 凭证池
 *
 * 用法（勿将 Key 写入仓库）：
 *   cd book-mall
 *   DASHSCOPE_S2V_BEIJING_API_KEY='sk-ws-...' pnpm gateway:bind-s2v-beijing
 *
 * 可选指定 canonical 平台账号邮箱：
 *   DASHSCOPE_S2V_BEIJING_API_KEY='sk-ws-...' pnpm gateway:bind-s2v-beijing 13808816802@126.com
 */
import {
  createGatewayCredential,
  getDecryptedCredentialApiKey,
  updateGatewayCredential,
} from "../lib/gateway/credential-service";
import {
  dashscopeDetectS2vImage,
  resolveDashscopeBeijingMaasBaseUrl,
} from "../lib/gateway/dashscope-client";
import { AI_SPACE_S2V_BEIJING_CREDENTIAL_ALIAS } from "../lib/ai-space/ai-space-gateway-auth";
import { getCanonicalPlatformPoolOwnerEmail } from "../lib/gateway/platform-credential-copy";
import {
  rebindManagedKeysToPlatformPool,
  syncCanonicalPlatformAdminKeyBindings,
} from "../lib/gateway/platform-credential-pool";
import { prisma } from "../lib/prisma";
import {
  findGatewayUserByBookUserId,
  syncGatewayUserFromBookUser,
} from "../lib/gateway/sync-user";

/** 阿里云文档示例人像（公开 URL） */
const SMOKE_DETECT_IMAGE =
  "https://img.alicdn.com/imgextra/i2/O1CN01vHOj4h28jOxUJPwY8_!!6000000007968-49-tps-1344-896.webp";

async function main() {
  const apiKey =
    process.env.DASHSCOPE_S2V_BEIJING_API_KEY?.trim() ||
    process.argv.find((a) => a.startsWith("sk-ws-"))?.trim() ||
    "";
  if (!apiKey.startsWith("sk-ws-")) {
    console.error(
      "请设置 DASHSCOPE_S2V_BEIJING_API_KEY（sk-ws- 开头的华北2业务空间 Key，勿提交 git）",
    );
    process.exit(1);
  }

  // wan2.2-s2v / detect 走 DashScope 通用根域名；华北2 由 sk-ws Key 本身标识。
  // `{WorkspaceId}.cn-beijing.maas.aliyuncs.com` 会触发 IllegalEndpoint（2026-08 实测）。
  const baseUrl = "https://dashscope.aliyuncs.com";
  const workspaceId = resolveDashscopeBeijingMaasBaseUrl(apiKey)?.match(
    /^https:\/\/([^.]+)\./,
  )?.[1];

  const emailArg =
    process.argv.slice(2).find((a) => a.includes("@"))?.trim() ||
    getCanonicalPlatformPoolOwnerEmail();
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

  const existing = await prisma.gatewayVendorCredential.findFirst({
    where: {
      userId: gwUser.id,
      providerKind: "DASHSCOPE",
      alias: AI_SPACE_S2V_BEIJING_CREDENTIAL_ALIAS,
    },
    select: { id: true },
  });

  let credentialId: string;
  if (existing) {
    await updateGatewayCredential(gwUser.id, existing.id, {
      apiKey,
      active: true,
      baseUrl,
      channel: "platform-pool",
    });
    credentialId = existing.id;
    console.log(`[ok] 已更新凭证 ${AI_SPACE_S2V_BEIJING_CREDENTIAL_ALIAS} id=${credentialId}`);
  } else {
    const created = await createGatewayCredential({
      userId: gwUser.id,
      alias: AI_SPACE_S2V_BEIJING_CREDENTIAL_ALIAS,
      providerKind: "DASHSCOPE",
      apiKey,
      baseUrl,
      channel: "platform-pool",
      isDefaultForProvider: false,
      sortOrder: -10,
    });
    credentialId = created.id;
    console.log(`[ok] 已创建凭证 ${AI_SPACE_S2V_BEIJING_CREDENTIAL_ALIAS} id=${credentialId}`);
  }

  await syncCanonicalPlatformAdminKeyBindings(gwUser.id);
  const { updated } = await rebindManagedKeysToPlatformPool();
  console.log(`[ok] Platform Admin / 托管 sk-gw 绑定已刷新: ${updated} 把`);
  console.log(`     baseUrl: ${baseUrl}${workspaceId ? ` (workspace ${workspaceId})` : ""}`);

  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred) {
    console.error("[warn] 凭证解密失败，跳过连通性探测");
    return;
  }

  console.log("\n== 连通性：wan2.2-s2v-detect（同步，约 0.004 元/张） ==");
  const detect = await dashscopeDetectS2vImage({
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
    imageUrl: SMOKE_DETECT_IMAGE,
  });
  if (!detect.ok) {
    console.error(`[fail] detect: ${detect.error}`);
    process.exit(1);
  }
  console.log(
    `[ok] detect checkPass=${detect.result.checkPass} humanoid=${detect.result.humanoid} requestId=${detect.result.requestId ?? "-"}`,
  );
  console.log("\n下一步：在 AI 空间合成台提交任务，或运行 pnpm gateway:smoke-ai-space -- <email>");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
