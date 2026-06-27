/**
 * 生视频看门狗 · 常驻定时巡检（web 进程内）。
 *
 * 与「被触发巡检」（canvas-queue 读路径 / poll-loop 末尾）互补：
 * 这里是不依赖外部 poll-loop 是否存活、也不依赖是否有人打开 Logs 页的「定时巡检」，
 * 每 `GATEWAY_VIDEO_WATCHDOG_RESIDENT_INTERVAL_MS`（默认 30s）跑一次 runGatewayVideoWatchdog。
 *
 * 看门狗本身轻量：只查 RUNNING 火山视频日志，按检查点（默认 300/500/600/900s + 末档后定期）
 * 向厂商核对并收口，且内部已节流（MIN_INTERVAL_MS）+ 复核并发封顶 + DB 标记去重，
 * 因此多副本同跑也安全。
 *
 * 开关：
 *  - GATEWAY_VIDEO_WATCHDOG_RESIDENT=0 关闭（默认开启）
 *  - GATEWAY_VIDEO_WATCHDOG_RESIDENT_INTERVAL_MS 巡检间隔（默认 30000）
 */

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

function residentEnabled(): boolean {
  const v = process.env.GATEWAY_VIDEO_WATCHDOG_RESIDENT?.trim().toLowerCase();
  // 默认开启；显式设为 0 / false 才关闭
  return !(v === "0" || v === "false");
}

const RESIDENT_INTERVAL_MS = () =>
  envInt("GATEWAY_VIDEO_WATCHDOG_RESIDENT_INTERVAL_MS", 30_000);

// 跨 HMR / 重复 register 的单例守卫（挂到 globalThis，避免热更新起多个定时器）
const GLOBAL_KEY = "__gatewayVideoWatchdogResidentTimer__";

type GlobalWithTimer = typeof globalThis & {
  [GLOBAL_KEY]?: NodeJS.Timeout | null;
};

export function startResidentGatewayVideoWatchdog(): void {
  if (!residentEnabled()) return;
  // 构建期不启动定时器
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const g = globalThis as GlobalWithTimer;
  if (g[GLOBAL_KEY]) return;

  const intervalMs = RESIDENT_INTERVAL_MS();

  const tick = () => {
    void (async () => {
      try {
        const { runGatewayVideoWatchdog } = await import(
          "@/lib/gateway/gateway-video-watchdog"
        );
        await runGatewayVideoWatchdog({ source: "resident-scheduler" });
      } catch (e) {
        console.warn(
          "[gateway-watchdog] resident tick failed",
          e instanceof Error ? e.message : String(e),
        );
      }
    })();
  };

  const timer = setInterval(tick, intervalMs);
  // 不阻塞进程退出
  if (typeof timer.unref === "function") timer.unref();
  g[GLOBAL_KEY] = timer;

  console.info(
    "[gateway-watchdog] resident scheduler started",
    JSON.stringify({ intervalMs }),
  );

  // 首跑稍作延迟，避开冷启动 + 迁移等启动期 DB 抖动
  setTimeout(tick, Math.min(10_000, intervalMs)).unref?.();
}
