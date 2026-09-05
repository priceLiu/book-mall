/**
 * wan2.2-s2v 对账缺口排查（AR-105）。
 *
 * 用法：
 *   pnpm exec dotenv -e .env.local -- tsx scripts/audit-s2v-reconciliation-gap.ts
 *   pnpm exec dotenv -e .env.local -- tsx scripts/audit-s2v-reconciliation-gap.ts --from=2026-07-01 --to=2026-08-22
 */
import { auditS2vReconciliationGap } from "@/lib/finance/reconciliation-v2/s2v-gap-audit";
import { normalizePeriod } from "@/lib/finance/reconciliation-v2/period-range";
import { prisma } from "@/lib/prisma";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function main() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(
    new Date(),
  );
  const [y, m] = today.split("-");
  const period = normalizePeriod({
    from: arg("from") ?? `${y}-${m}-01`,
    to: arg("to") ?? today,
  });

  const report = await auditS2vReconciliationGap({ period, take: 50 });

  console.log(JSON.stringify(report, null, 2));
  console.log("\n摘要：");
  console.log(`  Gateway S2V 日志 ${report.gatewayLogCount} 条，计量合计 ${report.gatewaySecondsTotal}s`);
  console.log(`  推断/回填后 ${report.inferredSecondsTotal}s，缺口 ${report.gapSecondsTotal}s`);
  console.log(`  缺 duration ${report.missingDurationCount} 条`);
  console.log(`  无 Gateway 日志的完成合成任务 ${report.composeTasksWithoutGatewayLog} 条`);
  console.log(`  合成任务音频时长合计 ${report.composeAudioSecondsTotal}s`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
