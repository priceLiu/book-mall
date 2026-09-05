/**
 * DeepSeek 凭证 channel 迁移预览 / 应用（UM-106）。
 *
 * 用法：
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/migrate-deepseek-credential-channels.ts
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/migrate-deepseek-credential-channels.ts --apply
 */
import { prisma } from "@/lib/prisma";

const TARGET_CHANNEL = "gw-platform-pool";

async function main() {
  const apply = process.argv.includes("--apply");
  const creds = await prisma.gatewayVendorCredential.findMany({
    where: { providerKind: "DEEPSEEK" },
    select: {
      id: true,
      alias: true,
      channel: true,
      apiKeyHint: true,
      active: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (creds.length === 0) {
    console.log("[migrate-deepseek-channel] 无 DEEPSEEK 凭证");
    return;
  }

  console.log(`[migrate-deepseek-channel] 找到 ${creds.length} 条 DEEPSEEK 凭证`);
  let wouldUpdate = 0;

  for (const c of creds) {
    const cur = c.channel?.trim() || "";
    const needs = cur !== TARGET_CHANNEL;
    console.log(
      `  · ${c.id} alias=${c.alias ?? "—"} channel=${cur || "(空)"} hint=${c.apiKeyHint ?? "—"} active=${c.active}${needs ? ` → ${TARGET_CHANNEL}` : " (已符合)"}`,
    );
    if (needs) wouldUpdate += 1;
  }

  if (!apply) {
    console.log(
      `[migrate-deepseek-channel] 预览完成：${wouldUpdate} 条待更新。加 --apply 写入 channel=${TARGET_CHANNEL}`,
    );
    console.log(
      "[migrate-deepseek-channel] 请在 DeepSeek 控制台创建 gw-canvas-pro2 / gw-assistant / gw-tool Key 并在 Gateway 模型管理页绑定。",
    );
    return;
  }

  const updated = await prisma.gatewayVendorCredential.updateMany({
    where: {
      providerKind: "DEEPSEEK",
      OR: [{ channel: null }, { channel: { not: TARGET_CHANNEL } }],
    },
    data: { channel: TARGET_CHANNEL },
  });

  console.log(`[migrate-deepseek-channel] 已更新 ${updated.count} 条凭证 channel → ${TARGET_CHANNEL}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
