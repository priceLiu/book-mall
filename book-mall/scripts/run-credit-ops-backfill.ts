/**
 * 一次性补跑：生成逾期工单并执行积分清零 ops。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/run-credit-ops-backfill.ts [--dry-run]
 */
import {
  generateCreditOpsWorkItems,
  runDailyExpireSweepOps,
  runDailySubscriptionResetOps,
} from "../lib/billing/credit-ops-service";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`[credit-ops-backfill] ${dryRun ? "DRY-RUN" : "EXECUTE"}`);

  const gen = await generateCreditOpsWorkItems({ includeOverdue: true });
  console.log("[credit-ops-backfill] generate:", gen);

  const expire = await runDailyExpireSweepOps({ dryRun, trigger: "SCRIPT" });
  console.log("[credit-ops-backfill] expire:", expire);

  const reset = await runDailySubscriptionResetOps({ dryRun, trigger: "SCRIPT" });
  console.log("[credit-ops-backfill] reset:", reset);

  console.log("[credit-ops-backfill] done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
