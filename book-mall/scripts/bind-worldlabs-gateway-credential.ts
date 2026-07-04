/**
 * 从 WORLDLABS_API_KEY 环境变量导入管理员 Gateway 凭证池，并绑定 Platform Admin Key。
 *
 *   cd book-mall && pnpm qr:bind-worldlabs-gateway
 */
import { syncPlatformCredentialPoolForBookUser } from "../lib/gateway/platform-credential-seed";
import { prisma } from "../lib/prisma";

async function main() {
  const apiKey = process.env.WORLDLABS_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "未找到 World Labs API Key：请在 book-mall/.env.local 设置 WORLDLABS_API_KEY",
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
    console.log(`     托管 sk-gw 已刷新: ${pool.managedKeysUpdated} 把`);

    const worldlabs = await prisma.gatewayVendorCredential.findFirst({
      where: { userId: gwUser.id, providerKind: "WORLDLABS", alias: "World Labs" },
      select: { id: true, active: true },
    });
    if (worldlabs) {
      console.log(`[ok] World Labs 凭证 id=${worldlabs.id} active=${worldlabs.active}`);
    } else {
      console.warn(`[warn] ${admin.email} 未找到 World Labs 凭证`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
