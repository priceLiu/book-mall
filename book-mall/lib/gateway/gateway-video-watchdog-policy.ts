/**
 * 生视频看门狗 · 何时向厂商主动复核（与 poll worker 是否在 tick 解耦）。
 *
 * 旧逻辑只在「lastPolledAt 滞后 > workerStaleMs」时复核，轮询正常但厂商 long-running /
 * 后处理卡死时永远进不了 recover。此处增加按 submittedAt 墙钟的多档检查点 + 末档后的定期间隔。
 */

export type WatchdogDueReason = "poll_stale" | "checkpoint" | "interval";

export type WatchdogDueDecision = {
  due: boolean;
  reason: WatchdogDueReason | null;
  /** 命中的检查点秒数（interval 时为当前 age 秒，便于日志） */
  checkpointSec?: number;
};

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

/** 默认 300s / 500s / 600s / 900s；可用 GATEWAY_VIDEO_WATCHDOG_CHECKPOINTS_SEC 覆盖 */
export function parseWatchdogCheckpointSec(): number[] {
  const raw =
    process.env.GATEWAY_VIDEO_WATCHDOG_CHECKPOINTS_SEC?.trim() ||
    "300,500,600,900";
  const out = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const sorted = [...new Set(out)].sort((a, b) => a - b);
  return sorted.length > 0 ? sorted : [300, 500, 600, 900];
}

export function readWatchdogLastRecoverAtMs(
  resultSummary: unknown,
): number | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const gateway = (resultSummary as Record<string, unknown>)._gateway;
  if (!gateway || typeof gateway !== "object") return null;
  const v = (gateway as Record<string, unknown>).watchdogLastRecoverAtMs;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

export function attachWatchdogLastRecoverAtMs(
  existing: unknown,
  atMs: number,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? ({ ...(existing as Record<string, unknown>) } as Record<string, unknown>)
      : existing != null
        ? ({ value: existing } as Record<string, unknown>)
        : ({} as Record<string, unknown>);
  const gateway =
    base._gateway && typeof base._gateway === "object"
      ? { ...(base._gateway as Record<string, unknown>) }
      : {};
  gateway.watchdogLastRecoverAtMs = atMs;
  base._gateway = gateway;
  return base;
}

export function watchdogMinRecoverGapMs(): number {
  return envInt("GATEWAY_VIDEO_WATCHDOG_RECOVER_GAP_MS", 60 * 1000);
}

export function watchdogIntervalAfterLastCheckpointMs(): number {
  return envInt("GATEWAY_VIDEO_WATCHDOG_INTERVAL_MS", 120 * 1000);
}

/** poll 停滞阈值（与 gateway-video-watchdog WORKER_STALE 默认一致） */
export function watchdogWorkerStaleMs(): number {
  return envInt("GATEWAY_VIDEO_WATCHDOG_WORKER_STALE_MS", 90 * 1000);
}

/** 兼容旧 env：首档复核下限，默认 300s */
export function watchdogLegacyTooLongMs(): number {
  return envInt("GATEWAY_VIDEO_WATCHDOG_MS", 5 * 60 * 1000);
}

/**
 * 是否应向厂商 recoverVolcengineGatewayLogFromVendor。
 * - poll_stale：跑太久且 lastPolledAt 滞后（worker 卡死 / 单条 poll 阻塞）
 * - checkpoint：墙钟越过某档检查点且自上次看门狗复核后尚未覆盖该档
 * - interval：已超过末档检查点后，按定期间隔继续复核（厂商 stuck running）
 */
export function decideWatchdogVendorCheck(input: {
  submittedAtMs: number;
  nowMs: number;
  lastPolledAtMs: number | null;
  lastWatchdogRecoverAtMs: number | null;
  checkpointsSec?: number[];
}): WatchdogDueDecision {
  const checkpointsSec = input.checkpointsSec ?? parseWatchdogCheckpointSec();
  const checkpointsMs = checkpointsSec.map((s) => s * 1000);
  const ageMs = input.nowMs - input.submittedAtMs;
  const pollLagMs =
    input.nowMs - (input.lastPolledAtMs ?? input.submittedAtMs);
  const workerStaleMs = watchdogWorkerStaleMs();
  const tooLongMs = watchdogLegacyTooLongMs();

  if (
    ageMs >= tooLongMs &&
    pollLagMs > workerStaleMs
  ) {
    return { due: true, reason: "poll_stale" };
  }

  const minGapMs = watchdogMinRecoverGapMs();
  const lastRecover = input.lastWatchdogRecoverAtMs ?? 0;
  if (lastRecover > 0 && input.nowMs - lastRecover < minGapMs) {
    return { due: false, reason: null };
  }

  for (const cpMs of checkpointsMs) {
    if (ageMs < cpMs) break;
    const checkpointAt = input.submittedAtMs + cpMs;
    if (lastRecover < checkpointAt) {
      return {
        due: true,
        reason: "checkpoint",
        checkpointSec: cpMs / 1000,
      };
    }
  }

  const lastCpMs = checkpointsMs[checkpointsMs.length - 1];
  if (
    lastCpMs != null &&
    ageMs >= lastCpMs &&
    input.nowMs - lastRecover >= watchdogIntervalAfterLastCheckpointMs()
  ) {
    return {
      due: true,
      reason: "interval",
      checkpointSec: Math.round(ageMs / 1000),
    };
  }

  return { due: false, reason: null };
}
