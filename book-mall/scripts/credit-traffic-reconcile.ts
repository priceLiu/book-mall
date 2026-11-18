/**
 * 积分疏通：释放失败冻结、补结成功未结算的冻结。
 *
 *   pnpm --dir book-mall billing:traffic-reconcile
 *   pnpm --dir book-mall billing:traffic-reconcile -- --release-stale-running
 */
import { inspectCreditTraffic, sweepCreditTraffic } from "../lib/billing/credit-traffic-control";

async function main() {
  const releaseStaleRunning = process.argv.includes("--release-stale-running");
  const before = await inspectCreditTraffic();
  console.log(
    "[credit-traffic] before",
    JSON.stringify({ counts: before.counts, pool: before.pool, open: before.items.length }),
  );
  const result = await sweepCreditTraffic({ releaseStaleRunning });
  const after = await inspectCreditTraffic();
  console.log("[credit-traffic] sweep", JSON.stringify(result));
  console.log("[credit-traffic] after", JSON.stringify({ counts: after.counts, open: after.items.length }));
  if (result.errors.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
