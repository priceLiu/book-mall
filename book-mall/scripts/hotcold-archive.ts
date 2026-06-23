#!/usr/bin/env tsx
/**
 * Gen-HotCold-R2/R3 · 大表静化归档 CLI。
 *
 * Gateway：终态且 completedAt 早于热窗（默认 1h）→ 归档表。
 * CreditLedger：默认 365 天。
 *
 * 用法：
 *   pnpm --dir book-mall hotcold:archive -- --dry-run
 *   pnpm --dir book-mall hotcold:archive -- --gateway-hours=1 --ledger-days=365
 *   pnpm --dir book-mall hotcold:archive -- --only=gateway --batch=500
 */
import {
  archiveCreditLedger,
  archiveGatewayLogs,
} from "@/lib/maintenance/hotcold-archive";
import {
  DEFAULT_CREDIT_LEDGER_RETENTION_DAYS,
} from "@/lib/maintenance/hotcold-archive-read";
import { getGatewayLogHotRetentionHours } from "@/lib/gateway/gateway-hot-window";
import { prisma } from "@/lib/prisma";

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const only = flag("only"); // gateway | ledger | undefined(both)
  const batchSize = Number(flag("batch") ?? 1000);
  const gatewayHours = Number(
    flag("gateway-hours") ?? getGatewayLogHotRetentionHours(),
  );
  const ledgerDays = Number(
    flag("ledger-days") ?? DEFAULT_CREDIT_LEDGER_RETENTION_DAYS,
  );

  const results = [];
  if (only !== "ledger") {
    results.push(
      await archiveGatewayLogs({
        hotRetentionHours: gatewayHours,
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

  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
