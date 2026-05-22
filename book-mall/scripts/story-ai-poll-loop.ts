/* eslint-disable no-console */
/**
 * 本地循环 KIE 轮询（替代上线后的 cron）：
 *   pnpm story:poll-loop                 # 默认每 10s 轮询一次
 *   STORY_POLL_INTERVAL_MS=5000 pnpm story:poll-loop
 *   STORY_CLEANUP_EVERY_N=12 pnpm story:poll-loop  # 每 12 轮顺手跑一次 cleanup（默认 6）
 *
 * 用 Ctrl-C 退出。
 *
 * 注意：仅限本地开发使用。线上请用 /api/story/kie/poll + /api/story/kie/cleanup 由 cron 触发。
 */
import {
  runCleanupWorker,
  runPollWorker,
} from "@/lib/story/story-task-service";

const POLL_INTERVAL_MS = (() => {
  const raw = Number(process.env.STORY_POLL_INTERVAL_MS ?? "");
  return Number.isFinite(raw) && raw >= 1000 ? raw : 10_000;
})();

const CLEANUP_EVERY_N = (() => {
  const raw = Number(process.env.STORY_CLEANUP_EVERY_N ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 6;
})();

let stopping = false;
let iter = 0;

function nowHHMMSS(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function tick() {
  iter += 1;
  try {
    const r = await runPollWorker();
    if (r.scanned > 0) {
      console.log(
        `[${nowHHMMSS()}] poll #${iter}`,
        JSON.stringify(r),
      );
    }
  } catch (e) {
    console.error(`[${nowHHMMSS()}] poll #${iter} error`, e);
  }

  if (iter % CLEANUP_EVERY_N === 0) {
    try {
      const r = await runCleanupWorker();
      if (r.scanned > 0) {
        console.log(
          `[${nowHHMMSS()}] cleanup #${iter}`,
          JSON.stringify(r),
        );
      }
    } catch (e) {
      console.error(`[${nowHHMMSS()}] cleanup #${iter} error`, e);
    }
  }
}

async function main() {
  console.log(
    `[story:poll-loop] starting, interval=${POLL_INTERVAL_MS}ms cleanupEvery=${CLEANUP_EVERY_N}`,
  );
  console.log(`[story:poll-loop] press Ctrl-C to stop`);

  process.on("SIGINT", () => {
    console.log("\n[story:poll-loop] SIGINT received, exiting after current tick...");
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

  console.log("[story:poll-loop] stopped");
  process.exit(0);
}

main().catch((e) => {
  console.error("[story:poll-loop] fatal", e);
  process.exit(1);
});
