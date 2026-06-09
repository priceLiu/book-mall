/**
 * 同步 AppModelOffering（毛利达标 + 最低净成本路由）。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/auto-publish-platform-offerings.ts
 */
import { autoPublishPlatformOfferings } from "../lib/platform-model/auto-publish-offerings";

async function main() {
  const r = await autoPublishPlatformOfferings({ publishedBy: "cli" });
  console.log(r);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });
