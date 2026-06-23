/**
 * Gen-HotCold-R2 Phase 4 · 画布任务轮询自适应间隔。
 *
 * 纯函数，便于单测。返回值含义：
 * - 0：无在飞任务，**暂停 DB 轮询**（由调用方用一个廉价的「空转再探」节拍唤醒）。
 * - >0：下一次轮询的间隔毫秒。
 *
 * 策略（对应计划 Phase 4）：
 * - stale（读道降级 / DB 塞车，tasks==null）→ 退避到 15s，给 DB 喘息。
 * - 无在飞 → 0（停）。
 * - 1 条在飞 → 3s。
 * - 2~3 条 → 5s。
 * - >3 条 → 8s（并发越多越退避，避免 2s 空轮询叠加放大 DB 压力）。
 */
export const CANVAS_POLL_STALE_BACKOFF_MS = 15_000;
/** 暂停态下的「空转再探」节拍（不打 DB，仅检测是否出现新在飞任务后唤醒轮询） */
export const CANVAS_POLL_IDLE_RECHECK_MS = 6_000;

export function nextPollIntervalMs(
  inflightCount: number,
  stale: boolean,
): number {
  if (stale) return CANVAS_POLL_STALE_BACKOFF_MS;
  if (inflightCount <= 0) return 0;
  if (inflightCount === 1) return 3_000;
  if (inflightCount <= 3) return 5_000;
  return 8_000;
}
