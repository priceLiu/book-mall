/**
 * AI 小智 · 每日热闻常驻补跑（不依赖 CloudBase 定时 HTTP 是否配置）。
 * book-mall 进程启动后周期性检查：当日无 READY 行则经 Gateway 预生成。
 */
import {
  cstDateKey,
  readDailyAiNews,
  runDailyAiNewsGeneration,
} from "@/lib/platform-assistant/ai-news-service";
import { getAssistantNewsRuntimeConfig } from "@/lib/platform-assistant/platform-assistant-model-config-service";

const DEFAULT_TICK_MS = 30 * 60 * 1000;
const MIN_RETRY_AFTER_FAIL_MS = 60 * 60 * 1000;
const GLOBAL_TIMER_KEY = "__platformAssistantAiNewsResidentTimer__";

type GlobalWithTimer = typeof globalThis & {
  [GLOBAL_TIMER_KEY]?: NodeJS.Timeout | null;
};

let lastAttemptMs = 0;
let inflight: Promise<"ok" | "failed"> | null = null;

function residentEnabled(): boolean {
  const v = process.env.PLATFORM_ASSISTANT_AI_NEWS_RESIDENT?.trim().toLowerCase();
  return !(v === "0" || v === "false");
}

function tickIntervalMs(): number {
  const raw = Number(process.env.PLATFORM_ASSISTANT_AI_NEWS_TICK_MS ?? "");
  return Number.isFinite(raw) && raw >= 60_000 ? Math.floor(raw) : DEFAULT_TICK_MS;
}

/** 当日无 READY 热闻时尝试生成（幂等；失败 1h 内不重试）。 */
export async function ensureTodayAiNewsIfMissing(
  now = new Date(),
): Promise<"skipped" | "ok" | "failed"> {
  const newsConfig = await getAssistantNewsRuntimeConfig();
  if (!newsConfig.enabled) return "skipped";

  const todayKey = cstDateKey(now);
  const existing = await readDailyAiNews(todayKey);
  if (existing) return "skipped";

  if (inflight) {
    return inflight.then((r) => (r === "ok" ? "ok" : "failed"));
  }

  const sinceLast = Date.now() - lastAttemptMs;
  if (lastAttemptMs > 0 && sinceLast < MIN_RETRY_AFTER_FAIL_MS) {
    return "skipped";
  }

  lastAttemptMs = Date.now();
  inflight = (async () => {
    try {
      await runDailyAiNewsGeneration(now);
      return "ok" as const;
    } catch (e) {
      console.warn(
        "[platform-assistant/ai-news] ensureToday failed",
        e instanceof Error ? e.message : String(e),
      );
      return "failed" as const;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** 读路径兜底：响应仍返回旧内容，后台补生成当日热闻。 */
export function scheduleTodayAiNewsIfMissing(): void {
  void ensureTodayAiNewsIfMissing().then((r) => {
    if (r === "ok") {
      console.info("[platform-assistant/ai-news] background ensureToday succeeded");
    }
  });
}

export function startResidentPlatformAssistantAiNewsScheduler(): void {
  if (!residentEnabled()) return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const g = globalThis as GlobalWithTimer;
  if (g[GLOBAL_TIMER_KEY]) return;

  const intervalMs = tickIntervalMs();

  const tick = () => {
    void ensureTodayAiNewsIfMissing().then((r) => {
      if (r === "ok") {
        console.info("[platform-assistant/ai-news] resident tick generated today");
      }
    });
  };

  const timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  g[GLOBAL_TIMER_KEY] = timer;

  console.info(
    "[platform-assistant/ai-news] resident scheduler started",
    JSON.stringify({ intervalMs }),
  );

  setTimeout(tick, Math.min(20_000, intervalMs)).unref?.();
}

/** @internal */
export function resetAiNewsSchedulerForTests() {
  lastAttemptMs = 0;
  inflight = null;
  const g = globalThis as GlobalWithTimer;
  if (g[GLOBAL_TIMER_KEY]) {
    clearInterval(g[GLOBAL_TIMER_KEY]!);
    g[GLOBAL_TIMER_KEY] = null;
  }
}
