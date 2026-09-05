#!/usr/bin/env tsx
/**
 * 本地 / 运维：预生成当日 AI 热闻并写入 DB。
 *
 *   pnpm --dir book-mall platform-assistant:ai-news-generate
 */
import { runDailyAiNewsGeneration } from "@/lib/platform-assistant/ai-news-service";

async function main() {
  console.log("[platform-assistant:ai-news-generate] starting…");
  const result = await runDailyAiNewsGeneration();
  console.log(
    `[platform-assistant:ai-news-generate] ok dateKey=${result.dateKey} pruned=${result.pruned.deleted}`,
  );
}

main().catch((e) => {
  console.error("[platform-assistant:ai-news-generate] failed:", e);
  process.exit(1);
});
