/**
 * 回填 AI 小智成功调用的 METER_ONLY 结算流水（历史 Gateway 日志）。
 *
 *   pnpm --dir book-mall tsx scripts/backfill-platform-assistant-settlements.ts
 *   pnpm --dir book-mall tsx scripts/backfill-platform-assistant-settlements.ts --dry-run
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
    select: { id: true, clientPage: true, submittedAt: true },
  });

  let created = 0;
  let skipped = 0;

  for (const log of logs) {
    const existing = await prisma.billingSettlementLine.findUnique({
      where: { gatewayLogId: log.id },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    const full = await prisma.gatewayRequestLog.findUnique({ where: { id: log.id } });
    if (!full) continue;
    if (dryRun) {
      console.log("[dry-run] would settle", log.id, log.clientPage, log.submittedAt.toISOString());
      created += 1;
      continue;
    }
    await recordPlatformAssistantMeterSettlement(full);
    created += 1;
  }

  console.log(
    `AI 小智结算回填完成：新增 ${created}，已有结算 ${skipped}，扫描成功日志 ${logs.length}${dryRun ? "（dry-run）" : ""}`,
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
