/**
 * 本地 / cron 手动触发画布展示对账（与 POST /api/canvas/display-reconcile 同逻辑）。
 *
 *   pnpm canvas:display-reconcile
 *   pnpm canvas:display-reconcile -- --limit=80
 */
import { reconcileCanvasInflightZombies } from "../lib/canvas/canvas-inflight-zombie-reconcile";
import { runCanvasDisplayReconcileWorker } from "../lib/canvas/canvas-video-display-recover";

function parseLimit(argv: string[]): number | undefined {
  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) return Math.min(n, 200);
    }
  }
  return undefined;
}

async function main() {
  const limit = parseLimit(process.argv.slice(2));
  const zombies = await reconcileCanvasInflightZombies({ limit });
  const display = await runCanvasDisplayReconcileWorker({ limit });
  console.log(JSON.stringify({ zombies, ...display }, null, 2));
}

main()
  .catch((e) => {
    console.error("[canvas-display-reconcile-once] error", e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });
