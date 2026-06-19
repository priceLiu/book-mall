#!/usr/bin/env tsx
/**
 * 生成交通控流对账：幽灵 RESERVE、RUNNING 超时、槽位计数、推进 QUEUED dispatch。
 *
 * 用法：pnpm --dir book-mall generation:reconcile-traffic
 */
import { reconcileGenerationTraffic } from "@/lib/generation/traffic-control/reconcile";

async function main() {
  const report = await reconcileGenerationTraffic({ dispatch: true });
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
