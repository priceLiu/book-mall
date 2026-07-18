/**
 * 从 docs/kimi.md 的 `key:` 行（或 MOONSHOT_API_KEY 环境变量）导入管理员 Gateway 凭证池，
 * 并绑定 Platform Admin Key / Personal Key。
 *
 *   cd book-mall && pnpm gateway:bind-moonshot
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { syncPlatformCredentialPoolForBookUser } from "../lib/gateway/platform-credential-seed";
import { prisma } from "../lib/prisma";

const KIMI_MD = resolve(__dirname, "../../docs/kimi.md");

function resolveMoonshotApiKeyFromDoc(): string | null {
  const text = readFileSync(KIMI_MD, "utf8");
  const line = text.match(/^key:\s*(sk-\S+)/im);
  return line?.[1]?.trim() ?? null;
}

async function main() {
  const fromEnv = process.env.MOONSHOT_API_KEY?.trim();
  const fromDoc = resolveMoonshotApiKeyFromDoc();
  const apiKey = fromEnv || fromDoc;
  if (!apiKey) {
    console.error(
      "未找到 Moonshot API Key：请在 docs/kimi.md 配置 key: sk-... 或设置 MOONSHOT_API_KEY",
    );
    process.exit(1);
  }
  process.env.MOONSHOT_API_KEY = apiKey;

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

    const moonshot = await prisma.gatewayVendorCredential.findFirst({
      where: { userId: gwUser.id, providerKind: "MOONSHOT", alias: "Kimi" },
      select: { id: true, active: true },
    });
    if (moonshot) {
      console.log(`[ok] Kimi 凭证 id=${moonshot.id} active=${moonshot.active}`);
      const bindings = await prisma.gatewayApiKeyCredential.findMany({
        where: {
          credentialId: moonshot.id,
          apiKey: { userId: gwUser.id, revokedAt: null },
        },
        include: { apiKey: { select: { name: true } } },
      });
      console.log(
        `     绑定 Key: ${bindings.map((b) => b.apiKey.name).join(", ") || "(无)"}`,
      );
    } else {
      console.warn(`[warn] ${admin.email} 未找到 Kimi 凭证`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
