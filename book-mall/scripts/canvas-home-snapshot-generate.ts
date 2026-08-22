#!/usr/bin/env tsx
/**
 * 本地 / 运维：预生成当日画布门户首页静态快照。
 *
 *   pnpm --dir book-mall canvas-home:snapshot-generate
 */
import { runCanvasHomeSnapshotGeneration } from "@/lib/static-snapshots/canvas-home-snapshot-service";

async function main() {
  console.log("[canvas-home:snapshot-generate] starting…");
  const result = await runCanvasHomeSnapshotGeneration({ trigger: "CLI" });
  console.log(
    `[canvas-home:snapshot-generate] ok dateKey=${result.dateKey} featured=${result.summary.featuredCount} templates=${result.summary.templateCount} film=${result.summary.filmShowcaseCount}`,
  );
}

main().catch((e) => {
  console.error("[canvas-home:snapshot-generate] failed:", e);
  process.exit(1);
});
