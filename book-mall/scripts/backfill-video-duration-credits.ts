/**
 * 回补视频按时长多扣积分（冻结/结算曾固定按 15s）。
 *
 * 用法：
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-video-duration-credits.ts --dry
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-video-duration-credits.ts --apply
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-video-duration-credits.ts --apply --date=2026-06-20
 */
import {
  billingCategoryLabel,
  classifyBillingCategory,
} from "../lib/billing/billing-category";
import { adjustCredits } from "../lib/billing/credit-account-service";
import {
  computeExpectedVideoCreditsForLog,
  resolveLogBillingTarget,
} from "../lib/billing/gateway-credit-settlement";
import { resolveBillableVideoSecondsFromLog } from "../lib/gateway/log-billing-metrics";
import { prisma } from "../lib/prisma";

const APPLY = process.argv.includes("--apply");

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

function dayBoundsLocal(dateStr: string): { from: Date; to: Date } {
  const from = new Date(`${dateStr}T00:00:00+08:00`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from, to };
}

async function main() {
  const dateStr =
    arg("date") ??
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
  const { from, to } = dayBoundsLocal(dateStr);

  console.log(`MODE: ${APPLY ? "APPLY" : "DRY"} · 日期 ${dateStr} (Asia/Shanghai)`);

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      requestKind: "VIDEO",
      status: "SUCCEEDED",
      billingMode: "PLATFORM_CREDIT",
      settlementKind: "PLATFORM_VIDEO",
      submittedAt: { gte: from, lt: to },
      creditsCharged: { gt: 0 },
    },
    orderBy: { submittedAt: "asc" },
  });

  console.log(`候选 ${logs.length} 条`);

  let fixed = 0;
  let skipped = 0;

  for (const log of logs) {
    const expected = await computeExpectedVideoCreditsForLog(log);
    if (!expected) {
      console.warn(`[skip] ${log.id} 无法计算应扣积分`);
      skipped += 1;
      continue;
    }

    const charged = log.creditsCharged ?? 0;
    const refund = charged - expected.credits;
    const seconds = resolveBillableVideoSecondsFromLog(log);

    if (refund <= 0) {
      if (charged !== expected.credits) {
        console.log(
          `[ok] ${log.id} duration=${seconds}s charged=${charged} expected=${expected.credits}`,
        );
      }
      skipped += 1;
      continue;
    }

    console.log(
      `[fix] ${log.id} model=${log.model} duration=${seconds}s charged=${charged} → ${expected.credits} refund=${refund}`,
    );

    if (!APPLY) {
      fixed += 1;
      continue;
    }

    const target = await resolveLogBillingTarget(log);
    if (!target) {
      console.warn(`[skip] ${log.id} 无计费归属`);
      skipped += 1;
      continue;
    }

    const reserveLedger = await prisma.creditLedger.findUnique({
      where: { idempotencyKey: `reserve:${log.id}` },
      select: { pool: true },
    });
    const pool = reserveLedger?.pool ?? "VIDEO";

    await adjustCredits({
      ref: target.ref,
      credits: refund,
      pool,
      actorUserId: target.actorUserId,
      gatewayLogId: log.id,
      idempotencyKey: `backfill-video-duration:${log.id}`,
      description: `视频按时长计费回补（${seconds}s，${charged}→${expected.credits} 积分）`,
    });

    await prisma.gatewayRequestLog.update({
      where: { id: log.id },
      data: { creditsCharged: expected.credits },
    });

    const catLabel = billingCategoryLabel(classifyBillingCategory(log));
    const feeDescription = `平台代付 · ${catLabel} · ${seconds} 秒 · 视频扣 ${expected.credits} 积分（已回补多扣 ${refund}）`;

    await prisma.billingSettlementLine.updateMany({
      where: { gatewayLogId: log.id },
      data: {
        creditsCharged: expected.credits,
        feeDescription,
      },
    });

    fixed += 1;
  }

  console.log(`[done] fixed=${fixed} skipped=${skipped} total=${logs.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
