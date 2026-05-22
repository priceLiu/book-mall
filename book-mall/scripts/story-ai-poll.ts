/* eslint-disable no-console */
/**
 * 本地一次性触发 KIE 轮询：
 *   pnpm story:poll-once
 *
 * 使用 .env.local 加载 KIE / DB / OSS 配置（与运行时一致）。
 */
import { runPollWorker } from "@/lib/story/story-task-service";

async function main() {
  const result = await runPollWorker();
  console.log("[story:poll-once]", JSON.stringify(result));
}

main().catch((e) => {
  console.error("[story:poll-once] error", e);
  process.exit(1);
});
