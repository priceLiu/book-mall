/**
 * gateway BYOK 异步任务轮询（独立于 canvas/story poll-loop）
 */
import { runGatewayPollWorker } from "@/lib/gateway/poll-service";

const POLL_INTERVAL_MS = Number(process.env.GATEWAY_POLL_INTERVAL_MS ?? "10000");

async function tick() {
  try {
    const r = await runGatewayPollWorker({ limit: 30 });
    if (r.updated > 0) {
      console.log(`[gateway-poll] updated=${r.updated} scanned=${r.scanned}`);
    }
  } catch (e) {
    console.error("[gateway-poll] error", e);
  }
}

console.log(`[gateway-poll] starting interval=${POLL_INTERVAL_MS}ms`);
void tick();
setInterval(tick, POLL_INTERVAL_MS);

process.on("SIGINT", () => {
  console.log("[gateway-poll] stopped");
  process.exit(0);
});
