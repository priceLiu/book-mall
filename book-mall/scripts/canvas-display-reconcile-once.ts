/**
 * 本地 / cron 手动触发画布展示对账（与 POST /api/canvas/display-reconcile 同逻辑）。
 *
 *   pnpm canvas:display-reconcile
 *   pnpm canvas:display-reconcile -- --limit=80
 *   pnpm canvas:display-reconcile -- --verbose
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

function parseVerbose(argv: string[]): boolean {
  return argv.includes("--verbose") || argv.includes("-v");
}

async function main() {
  const argv = process.argv.slice(2);
  const limit = parseLimit(argv);
  const verbose = parseVerbose(argv);
  const zombies = await reconcileCanvasInflightZombies({ limit });

  if (verbose) {
    const { findCanvasVideoTasksNeedingRecovery, recoverCanvasVideoTaskDisplay } =
      await import("../lib/canvas/canvas-video-display-recover");
    const candidates = await findCanvasVideoTasksNeedingRecovery({ limit });
    const details = [];
    const actions = {
      patched_runtime: 0,
      applied_from_gateway: 0,
      recovered_vendor: 0,
      noop: 0,
      failed: 0,
    };
    let recovered = 0;
    let failed = 0;
    for (const c of candidates) {
      const r = await recoverCanvasVideoTaskDisplay(c.taskId);
      actions[r.action] += 1;
      if (r.ok && r.action !== "noop" && r.action !== "failed") recovered += 1;
      if (!r.ok || r.action === "failed") failed += 1;
      details.push({
        taskId: c.taskId,
        projectName: c.projectName,
        nodeId: c.nodeId,
        taskStatus: c.taskStatus,
        failCode: c.failCode,
        gatewayStatus: c.gatewayStatus,
        hasMedia: c.hasMedia,
        runtimeStatus: c.runtimeStatus,
        recover: { ok: r.ok, action: r.action, reason: r.reason },
      });
    }
    console.log(
      JSON.stringify(
        {
          zombies,
          candidates: candidates.length,
          recovered,
          noop: actions.noop,
          failed,
          actions,
          details,
        },
        null,
        2,
      ),
    );
    return;
  }

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
