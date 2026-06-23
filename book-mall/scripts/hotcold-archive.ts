#!/usr/bin/env tsx
/**
 * Gen-HotCold-R2 Phase 5A · 大表静化归档 CLI。
 *
 * 把终态/过期数据从主表搬迁到归档表（事务内 INSERT+DELETE，按 id 幂等，可重复跑）。
 *
 * 用法：
 *   pnpm --dir book-mall hotcold:archive -- --dry-run
 *   pnpm --dir book-mall hotcold:archive -- --gateway-days=90 --ledger-days=365
 *   pnpm --dir book-mall hotcold:archive -- --only=gateway --batch=500
 *
 * 默认 dry-run = false；务必先 --dry-run 看候选量再执行。
 */
import {
  archiveCreditLedger,
  archiveGatewayLogs,
} from "@/lib/maintenance/hotcold-archive";
import {
  DEFAULT_CREDIT_LEDGER_RETENTION_DAYS,
  DEFAULT_GATEWAY_LOG_RETENTION_DAYS,
} from "@/lib/maintenance/hotcold-archive-read";
import { prisma } from "@/lib/prisma";

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const only = flag("only"); // gateway | ledger | undefined(both)
  const batchSize = Number(flag("batch") ?? 1000);
  const gatewayDays = Number(
    flag("gateway-days") ?? DEFAULT_GATEWAY_LOG_RETENTION_DAYS,
  );
  const ledgerDays = Number(
    flag("ledger-days") ?? DEFAULT_CREDIT_LEDGER_RETENTION_DAYS,
  );

  const results = [];
  if (only !== "ledger") {
    results.push(
      await archiveGatewayLogs({
        retentionDays: gatewayDays,
        batchSize,
        dryRun,
      }),
    );
  }
  if (only !== "gateway") {
    results.push(
      await archiveCreditLedger({
        retentionDays: ledgerDays,
        batchSize,
        dryRun,
      }),
    );
  }

  console.log(JSON.stringify({ dryRun, results }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
