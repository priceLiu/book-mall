/**
 * 补扣「已成功但未扣积分」的 Gateway 日志（缺报价配置等历史原因）。
 *
 * 用法：
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-missed-gateway-credit.ts --email abc@126.com --dry
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-missed-gateway-credit.ts --log-id <GatewayRequestLog.id>
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-missed-gateway-credit.ts --email abc@126.com
 */
import { settleSucceededGatewayLog } from "../lib/billing/gateway-credit-settlement";
import { resolveCostSnapshot } from "../lib/gateway/credit-billing-guard";
import { resolveBillableImageCountFromLog } from "../lib/gateway/log-billing-metrics";
import { prisma } from "../lib/prisma";

const DRY = process.argv.includes("--dry");

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function findCandidateLogs(input: {
  email?: string;
  logId?: string;
}) {
  if (input.logId) {
    const log = await prisma.gatewayRequestLog.findUnique({ where: { id: input.logId } });
    return log ? [log] : [];
  }

  const email = input.email?.trim();
  if (!email) {
    throw new Error("请提供 --email= 或 --log-id=");
  }

  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error(`用户不存在: ${email}`);

  return prisma.gatewayRequestLog.findMany({
    where: {
      actorBookUserId: user.id,
      status: "SUCCEEDED",
      billingMode: "PLATFORM_CREDIT",
      settlementKind: "NONE",
      OR: [{ creditsCharged: null }, { creditsCharged: 0 }],
    },
    orderBy: { submittedAt: "asc" },
  });
}

async function backfillLog(logId: string): Promise<"skipped" | "dry" | "ok"> {
  const log = await prisma.gatewayRequestLog.findUnique({ where: { id: logId } });
  if (!log) {
    console.warn(`[skip] 日志不存在 ${logId}`);
    return "skipped";
  }
  if (log.status !== "SUCCEEDED") {
    console.warn(`[skip] ${logId} 非成功状态`);
    return "skipped";
  }
  if (log.billingMode === "BYOK") {
    console.warn(`[skip] ${logId} BYOK 不走平台积分补扣`);
    return "skipped";
  }

  const existingLedger = await prisma.creditLedger.findFirst({
    where: { idempotencyKey: `gateway_log:${log.id}` },
  });
  if (existingLedger) {
    console.warn(`[skip] ${log.id} 已有 CONSUME 流水`);
    return "skipped";
  }

  const canonical = log.canonicalModelKey ?? log.model;
  if (!canonical) {
    console.warn(`[skip] ${log.id} 无 canonicalModelKey`);
    return "skipped";
  }

  const snapshot = await resolveCostSnapshot(canonical);
  if (!snapshot) {
    console.warn(`[skip] ${log.id} 仍无报价快照 canonical=${canonical}`);
    return "skipped";
  }

  const settlement = await prisma.billingSettlementLine.findUnique({
    where: { gatewayLogId: log.id },
  });

  console.log(`[candidate] ${log.id} model=${log.model} at=${log.submittedAt.toISOString()} settlement=${settlement?.settlementKind ?? "none"}`);

  if (DRY) return "dry";

  await prisma.$transaction(async (tx) => {
    if (settlement) {
      await tx.billingSettlementLine.delete({ where: { id: settlement.id } });
    }
  });

  const charged = await settleSucceededGatewayLog({
    log,
    snapshot,
    metrics: { images: resolveBillableImageCountFromLog(log) },
  });

  console.log(`[ok] ${log.id} 补扣 ${charged} 积分`);
  return charged > 0 ? "ok" : "skipped";
}

async function main() {
  const email = arg("email");
  const logId = arg("log-id");
  const logs = await findCandidateLogs({ email, logId });

  if (logs.length === 0) {
    console.log("[done] 无待补扣记录");
    return;
  }

  let ok = 0;
  let skipped = 0;
  for (const log of logs) {
    const r = await backfillLog(log.id);
    if (r === "ok" || r === "dry") ok += 1;
    else skipped += 1;
  }

  console.log(`[done] candidates=${logs.length} processed=${ok} skipped=${skipped} dry=${DRY}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
