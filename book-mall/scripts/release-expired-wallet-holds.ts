/**
 * 给「不在 Vercel 上跑」的部署兜底：定期调用 releaseExpiredHolds()。
 *
 * 用法（本地 / cron）：
 *   pnpm wallet-holds:expire
 * 或直接：
 *   node_modules/.bin/dotenv -e .env.local -- node_modules/.bin/tsx scripts/release-expired-wallet-holds.ts
 *
 * 与 /api/admin/wallet-holds/expire 行为一致；脚本路径不需要 secret，仅需能连库。
 */
import { releaseExpiredHolds } from "../lib/wallet-holds";
import { prisma } from "../lib/prisma";

async function main() {
  const expired = await releaseExpiredHolds();
  console.log(JSON.stringify({ ok: true, expired, at: new Date().toISOString() }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
