#!/usr/bin/env tsx
/**
 * gateway BYOK 异步任务轮询（独立于 canvas/story poll-loop）
 * DB 不可用时指数退避，避免 P1001 雪崩。
 */
import { runGatewayPollWorker } from "@/lib/gateway/poll-service";
import {
  isPollWorkerDbError,
  nextPollIntervalMs,
  pollDbFailureStreak,
} from "@/lib/db-poll-backoff";

const BASE_POLL_MS = Number(process.env.GATEWAY_POLL_INTERVAL_MS ?? "10000");

let stopping = false;

async function tick(): Promise<boolean> {
  try {
    const r = await runGatewayPollWorker({ limit: 30 });
    if (r.updated > 0) {
      console.log(`[gateway-poll] updated=${r.updated} scanned=${r.scanned}`);
    }
    return false;
  } catch (e) {
    console.error("[gateway-poll] error", e);
    return isPollWorkerDbError(e);
  }
}

async function main() {
  console.log(`[gateway-poll] starting baseInterval=${BASE_POLL_MS}ms`);
  process.on("SIGINT", () => {
    stopping = true;
    console.log("[gateway-poll] stopped");
    process.exit(0);
  });

  while (!stopping) {
    const dbError = await tick();
    const waitMs = nextPollIntervalMs(BASE_POLL_MS, dbError);
    if (dbError && pollDbFailureStreak() > 1) {
      console.warn(
        `[gateway-poll] db backoff ${waitMs}ms (streak=${pollDbFailureStreak()})`,
      );
    }
    await new Promise((res) => setTimeout(res, waitMs));
  }
}

main().catch((e) => {
  console.error("[gateway-poll] fatal", e);
  process.exit(1);
});
