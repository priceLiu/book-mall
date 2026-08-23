/**
 * 回填 AI 小智成功调用的 METER_ONLY 结算流水（历史 Gateway 日志）。
 *
 *   pnpm --dir book-mall exec dotenv -e .env.local -- tsx scripts/backfill-platform-assistant-settlements.ts
 *   pnpm --dir book-mall exec dotenv -e .env.local -- tsx scripts/backfill-platform-assistant-settlements.ts --dry-run
 */
import { prisma } from "@/lib/prisma";
import {
  buildPlatformAssistantGatewayLogWhere,
  recordPlatformAssistantMeterSettlement,
} from "@/lib/platform-assistant/platform-assistant-billing";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const logs = await prisma.gatewayRequestLog.findMany({
    where: buildPlatformAssistantGatewayLogWhere({ status: "SUCCEEDED" }),
    orderBy: { submittedAt: "asc" },
  });

  const existing = await prisma.billingSettlementLine.findMany({
    where: { gatewayLogId: { in: logs.map((l) => l.id) } },
    select: { gatewayLogId: true },
  });
  const settled = new Set(existing.map((r) => r.gatewayLogId));

  let created = 0;
  let skipped = settled.size;
  let failed = 0;

  for (const log of logs) {
    if (settled.has(log.id)) continue;

    if (dryRun) {
      console.log("[dry-run] would settle", log.id, log.clientPage, log.submittedAt.toISOString());
      created += 1;
      continue;
    }

    try {
      await recordPlatformAssistantMeterSettlement(log, {
        skipOperationalKeyCheck: true,
      });
      created += 1;
      if (created % 10 === 0) {
        console.log(`… 已回填 ${created} 条`);
      }
    } catch (e) {
      failed += 1;
      console.warn(
        "[backfill] failed",
        log.id,
        e instanceof Error ? e.message : e,
      );
    }
  }

  console.log(
    `AI 小智结算回填完成：新增 ${created}，已有结算 ${skipped}，失败 ${failed}，扫描成功日志 ${logs.length}${dryRun ? "（dry-run）" : ""}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
