/* eslint-disable no-console */
/**
 * 本地一次性触发 OSS 清理：
 *   pnpm story:cleanup-once
 */
import { runCleanupWorker } from "@/lib/story/story-task-service";

async function main() {
  const result = await runCleanupWorker();
  console.log("[story:cleanup-once]", JSON.stringify(result));
}

main().catch((e) => {
  console.error("[story:cleanup-once] error", e);
  process.exit(1);
});
