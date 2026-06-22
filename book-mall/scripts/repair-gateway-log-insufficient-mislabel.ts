#!/usr/bin/env tsx
/**
 * 修正历史 Gateway 日志：failCode=INSUFFICIENT_CREDITS 但 failMessage 为 Prisma 事务超时。
 *
 *   pnpm --dir book-mall gateway:repair-insufficient-mislabel -- --dry-run
 *   pnpm --dir book-mall gateway:repair-insufficient-mislabel -- --apply
 */
import { prisma } from "@/lib/prisma";
import { isMislabeledInsufficientCreditsLog } from "@/lib/billing/billing-failure-map";

const FRIENDLY =
  "系统繁忙，积分冻结超时，请稍后重试；若余额充足仍失败，请联系管理员。";

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply || process.argv.includes("--dry-run");

  const rows = await prisma.gatewayRequestLog.findMany({
    where: { failCode: "INSUFFICIENT_CREDITS" },
    select: { id: true, failMessage: true, submittedAt: true },
    orderBy: { submittedAt: "desc" },
    take: 5000,
  });

  const targets = rows.filter((r) =>
    isMislabeledInsufficientCreditsLog({
      failCode: "INSUFFICIENT_CREDITS",
      failMessage: r.failMessage,
    }),
  );

  console.log(`扫描 ${rows.length} 条 INSUFFICIENT_CREDITS，误标 ${targets.length} 条`);
  if (targets.length === 0) return;

  if (dryRun) {
    console.log("dry-run 样例（前 5）：");
    for (const t of targets.slice(0, 5)) {
      console.log(`  ${t.id} @ ${t.submittedAt.toISOString()}`);
    }
    console.log("加 --apply 写入 failCode=SYSTEM_BUSY");
    return;
  }

  let n = 0;
  for (const t of targets) {
    await prisma.gatewayRequestLog.update({
      where: { id: t.id },
      data: { failCode: "SYSTEM_BUSY", failMessage: FRIENDLY },
    });
    n++;
  }
  console.log(`已修正 ${n} 条`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
