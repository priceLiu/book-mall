/**
 * 将文生试衣 meta.textTryonResults 补写入试衣库（model-tryon 模块资产）。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/backfill-text-tryon-tryon-library.ts --user-email you@example.com [--today] [--confirm]
 */
import { prisma } from "../lib/prisma";
import {
  backfillTextTryonResultsToTryonLibrary,
  shanghaiDayBounds,
} from "../lib/ecom/ecom-text-tryon-tryon-library-backfill";

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1]?.trim() || undefined;
}

const email = readArg("--user-email");
const todayOnly = process.argv.includes("--today");
const confirm = process.argv.includes("--confirm");

async function main() {
  if (!email) {
    console.error("用法: tsx scripts/backfill-text-tryon-tryon-library.ts --user-email <email> [--today] [--confirm]");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) {
    console.error(`未找到用户: ${email}`);
    process.exitCode = 1;
    return;
  }

  const bounds = todayOnly ? shanghaiDayBounds() : undefined;
  const dryRun = !confirm;

  if (dryRun) {
    console.log(`DRY-RUN · 用户 ${user.email}${todayOnly ? " · 仅今日(上海)" : " · 全部历史"}`);
  }

  const result = await backfillTextTryonResultsToTryonLibrary(user.id, {
    since: bounds?.start,
    until: bounds?.end,
    dryRun,
  });

  console.log("[backfill-text-tryon-tryon-library]", result);
  if (dryRun && result.saved > 0) {
    console.log("加 --confirm 实际写入试衣库");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
