/**
 * Gateway 看门狗 · 常驻定时巡检（web 进程内）。
 *
 * 与「被触发巡检」（canvas-queue 读路径 / poll-loop 末尾）互补：
 * 这里是不依赖外部 poll-loop 是否存活、也不依赖是否有人打开 Logs 页的「定时巡检」，
 * 每 `GATEWAY_VIDEO_WATCHDOG_RESIDENT_INTERVAL_MS`（默认 30s）跑一次：
 *  1. runGatewayVideoWatchdog —— 火山在途视频按检查点向厂商核对并收口；
 *  2. runGatewayPollWorker —— 推进所有异步在途任务：轮询火山 / 其它厂商，并对
 *     KIE（回调型）做 backstop 补捞，同时内部已包含 expireStaleGatewayLogs 卡死收口。
 *     这样即便 `gateway:poll-loop` 进程没起（如 `dev:all --no-poll`）、或本地收不到
 *     KIE 回调，KIE 生图/异步任务也会在进程内被轮询收口，而不会一直停留在 RUNNING。
 *     （`GATEWAY_POLL_RESIDENT=0` 时退化为仅 expireStaleGatewayLogs 收口，
 *      用于已单独部署 poll-loop、想避免 web 多副本重复轮询的生产环境。）
 *
 * 各步都轻量、内部已节流 / DB 标记去重 / updateMany 幂等、轮询本身幂等，多副本同跑安全。
 *
 * 开关：
 *  - GATEWAY_VIDEO_WATCHDOG_RESIDENT=0 关闭整个常驻巡检（默认开启）
 *  - GATEWAY_POLL_RESIDENT=0 仅关闭进程内轮询，保留 expire 收口（默认开启）
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

function residentPollEnabled(): boolean {
  const v = process.env.GATEWAY_POLL_RESIDENT?.trim().toLowerCase();
  // 默认开启；显式设为 0 / false 才退化为仅 expire 收口
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
      // 推进异步在途任务 + 卡死收口：不依赖 gateway:poll-loop 进程是否存活、
      // 也不依赖本地能否收到 KIE 回调。runGatewayPollWorker 内部已含
      // expireStaleGatewayLogs，因此默认走它即可同时收口 + 轮询（含 KIE backstop）。
      try {
        if (residentPollEnabled()) {
          const { runGatewayPollWorker } = await import(
            "@/lib/gateway/poll-service"
          );
          await runGatewayPollWorker();
        } else {
          const { expireStaleGatewayLogs } = await import(
            "@/lib/gateway/poll-service"
          );
          const n = await expireStaleGatewayLogs();
          if (n > 0) {
            console.info(
              "[gateway-watchdog] resident expireStaleGatewayLogs",
              JSON.stringify({ expired: n }),
            );
          }
        }
      } catch (e) {
        console.warn(
          "[gateway-watchdog] resident poll/expire failed",
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
