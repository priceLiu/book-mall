/* eslint-disable no-console */
/**
 * 本地循环 KIE 轮询（canvas）：
 *   pnpm canvas:poll-loop                     # 每 10s 轮一次
 *   CANVAS_POLL_INTERVAL_MS=5000 pnpm canvas:poll-loop
 *   CANVAS_CLEANUP_EVERY_N=12 pnpm canvas:poll-loop
 *
 * 用 Ctrl-C 退出。仅本地开发使用；线上请用 /api/canvas/kie/poll 由 cron 触发。
 */
import {
  runCanvasCleanupWorker,
  runCanvasPollWorker,
} from "@/lib/canvas/canvas-task-service";
import { createHeartbeat } from "@/lib/dev-heartbeat";

const POLL_INTERVAL_MS = (() => {
  const raw = Number(process.env.CANVAS_POLL_INTERVAL_MS ?? "");
  return Number.isFinite(raw) && raw >= 1000 ? raw : 10_000;
})();

const CLEANUP_EVERY_N = (() => {
  const raw = Number(process.env.CANVAS_CLEANUP_EVERY_N ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 6;
})();

let stopping = false;
let iter = 0;
const heartbeat = createHeartbeat({
  id: "canvas-poll",
  intervalMs: POLL_INTERVAL_MS,
});

function nowHHMMSS(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function tick() {
  iter += 1;
  let lastResult: Record<string, unknown> | null = null;
  try {
    const r = await runCanvasPollWorker();
    lastResult = r as unknown as Record<string, unknown>;
    if (r.scanned > 0) {
      console.log(`[${nowHHMMSS()}] canvas-poll #${iter}`, JSON.stringify(r));
    }
  } catch (e) {
    console.error(`[${nowHHMMSS()}] canvas-poll #${iter} error`, e);
    await heartbeat.recordError(e);
  }
  if (iter % CLEANUP_EVERY_N === 0) {
    try {
      const r = await runCanvasCleanupWorker();
      if (r.scanned > 0) {
        console.log(
          `[${nowHHMMSS()}] canvas-cleanup #${iter}`,
          JSON.stringify(r),
        );
      }
    } catch (e) {
      console.error(`[${nowHHMMSS()}] canvas-cleanup #${iter} error`, e);
    }
  }
  await heartbeat.recordTick(lastResult);
}

async function main() {
  console.log(
    `[canvas:poll-loop] starting, interval=${POLL_INTERVAL_MS}ms cleanupEvery=${CLEANUP_EVERY_N}`,
  );
  console.log(`[canvas:poll-loop] press Ctrl-C to stop`);

  process.on("SIGINT", () => {
    console.log(
      "\n[canvas:poll-loop] SIGINT received, exiting after current tick...",
    );
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });

  while (!stopping) {
    await tick();
    if (stopping) break;
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }

  console.log("[canvas:poll-loop] stopped");
  process.exit(0);
}

main().catch((e) => {
  console.error("[canvas:poll-loop] fatal", e);
  process.exit(1);
});
