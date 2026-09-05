/**
 * Gateway 阻塞预警 · 常驻 10 分钟扫描 + 安全自愈。
 * 不依赖有人打开管理后台或 Logs 页。
 */
import { gatewayHealthScanIntervalMs } from "@/lib/gateway/gateway-health-policy";

function residentEnabled(): boolean {
  const v = process.env.GATEWAY_HEALTH_RESIDENT?.trim().toLowerCase();
  return !(v === "0" || v === "false");
}

const GLOBAL_KEY = "__gatewayHealthResidentTimer__";

type GlobalWithTimer = typeof globalThis & {
  [GLOBAL_KEY]?: NodeJS.Timeout | null;
};

export function startResidentGatewayHealthScanner(): void {
  if (!residentEnabled()) return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const g = globalThis as GlobalWithTimer;
  if (g[GLOBAL_KEY]) return;

  const intervalMs = gatewayHealthScanIntervalMs();

  const tick = () => {
    void (async () => {
      try {
        const { healGatewayHealth } = await import(
          "@/lib/gateway/gateway-health-service"
        );
        const r = await healGatewayHealth({ source: "resident-scheduler" });
        if (r.after.opsHealth !== "healthy" || r.heal.staleChatClosed > 0) {
          console.info(
            "[gateway-health] resident tick",
            JSON.stringify({
              opsHealth: r.after.opsHealth,
              alerts: r.after.alerts.map((a) => a.code),
              heal: {
                staleChatClosed: r.heal.staleChatClosed,
                expired: r.heal.expired,
                canvasRecovered: r.heal.canvasRecovered,
              },
            }),
          );
        }
      } catch (e) {
        console.warn(
          "[gateway-health] resident tick failed",
          e instanceof Error ? e.message : String(e),
        );
      }
    })();
  };

  const timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  g[GLOBAL_KEY] = timer;

  console.info(
    "[gateway-health] resident scanner started",
    JSON.stringify({ intervalMs }),
  );

  setTimeout(tick, Math.min(15_000, intervalMs)).unref?.();
}
