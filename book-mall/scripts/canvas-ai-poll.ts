/* eslint-disable no-console */
/**
 * 本地一次性触发 KIE 轮询（canvas）：
 *   pnpm canvas:poll-once
 */
import { runCanvasPollWorker } from "@/lib/canvas/canvas-task-service";

async function main() {
  const result = await runCanvasPollWorker();
  console.log("[canvas:poll-once]", JSON.stringify(result));
}

main().catch((e) => {
  console.error("[canvas:poll-once] error", e);
  process.exit(1);
});
