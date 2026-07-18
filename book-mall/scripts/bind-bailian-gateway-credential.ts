/**
 * 从 .env.local 的 DASHSCOPE_API_KEY 导入管理员 Gateway 百炼凭证池，
 * 并绑定 Platform Admin Key / Personal Key。
 *
 *   cd book-mall && pnpm gateway:bind-bailian
 */
import { syncPlatformCredentialPoolForBookUser } from "../lib/gateway/platform-credential-seed";
import { setDefaultGatewayCredential } from "../lib/gateway/credential-service";
import { prisma } from "../lib/prisma";

async function main() {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "未找到 DASHSCOPE_API_KEY：请在 book-mall/.env.local 配置 DashScope API Key",
    );
    process.exit(1);
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (admins.length === 0) {
    console.error("未找到 ADMIN 用户");
    process.exit(1);
  }

  for (const admin of admins) {
    const gwUser = await prisma.gatewayUser.findFirst({
      where: { bookUserId: admin.id },
      select: { id: true },
    });
    if (!gwUser) {
      console.warn(`[skip] ${admin.email} 无 Gateway 用户`);
      continue;
    }

    const pool = await syncPlatformCredentialPoolForBookUser(admin.id);
    console.log(`[ok] ${admin.email} Gateway 凭证池已同步`);
    console.log(`     凭证数: ${pool.credentialCount}`);
    console.log(`     Platform Admin Key: ${pool.platformAdminKeyId}`);

    for (const kind of ["BAILIAN", "DASHSCOPE"] as const) {
      const alias = kind === "BAILIAN" ? "百炼" : "DashScope";
      const cred = await prisma.gatewayVendorCredential.findFirst({
        where: { userId: gwUser.id, providerKind: kind, alias },
        select: { id: true, active: true, baseUrl: true, isDefaultForProvider: true },
      });
      if (cred) {
        if (!cred.isDefaultForProvider) {
          await setDefaultGatewayCredential(gwUser.id, cred.id);
        }
        console.log(
          `[ok] ${alias} (${kind}) id=${cred.id} active=${cred.active} default=true`,
        );
        console.log(`     baseUrl: ${cred.baseUrl ?? "(default)"}`);
        const bindings = await prisma.gatewayApiKeyCredential.findMany({
          where: {
            credentialId: cred.id,
            apiKey: { userId: gwUser.id, revokedAt: null },
          },
          include: { apiKey: { select: { name: true } } },
        });
        console.log(
          `     绑定 Key: ${bindings.map((b) => b.apiKey.name).join(", ") || "(无)"}`,
        );
      } else {
        console.warn(`[warn] ${admin.email} 未找到 ${alias} 凭证`);
      }
    }

    for (const modelKey of ["qwen3.7-plus", "qwen3.5-plus", "qwen3-vl-plus"]) {
      const route = await prisma.gatewayModelRoute.findFirst({
        where: { modelKey, active: true },
        select: { canonicalModelKey: true, providerKind: true },
      });
      console.log(
        route
          ? `[ok] 模型已注册 ${modelKey} → ${route.canonicalModelKey} (${route.providerKind})`
          : `[warn] 模型未注册 ${modelKey}`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
