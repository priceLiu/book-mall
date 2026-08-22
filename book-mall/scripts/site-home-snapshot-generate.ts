#!/usr/bin/env tsx
/**
 * 本地 / 运维：预生成当日首页静态快照。
 *
 *   pnpm --dir book-mall site-home:snapshot-generate
 */
import { runSiteHomeSnapshotGeneration } from "@/lib/static-snapshots/site-home-snapshot-service";

async function main() {
  console.log("[site-home:snapshot-generate] starting…");
  const result = await runSiteHomeSnapshotGeneration({ trigger: "CLI" });
  console.log(
    `[site-home:snapshot-generate] ok dateKey=${result.dateKey} apps=${result.summary.platformAppCount} models=${result.summary.gatewayModelCount}`,
  );
}

main().catch((e) => {
  console.error("[site-home:snapshot-generate] failed:", e);
  process.exit(1);
});
