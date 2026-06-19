/**
 * 恢复画布火山 Seedance 视频：误标 timeout 但厂商已 succeeded 的任务。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/recover-canvas-volcengine-timeout.ts [taskId...]
 *
 * 无参数时恢复项目「画布 20260619-094750」下已知的三条误杀任务。
 */
import { recoverCanvasVolcengineTimedOutTask } from "../lib/canvas/canvas-volcengine-recover";

const DEFAULT_TASK_IDS = [
  "cmqkrdc6p00d6sh01f6trvdki",
  "cmqkr01ay00btsh01s4umndoe",
  "cmqkqmll6005zsh01io6nl23e",
];

async function main() {
  const taskIds = process.argv.slice(2);
  const ids = taskIds.length > 0 ? taskIds : DEFAULT_TASK_IDS;

  for (const taskId of ids) {
    const result = await recoverCanvasVolcengineTimedOutTask(taskId);
    console.log(`[recover] ${taskId}`, result);
  }
}

main()
  .catch((e) => {
    console.error("[recover-canvas-volcengine-timeout] error", e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });
