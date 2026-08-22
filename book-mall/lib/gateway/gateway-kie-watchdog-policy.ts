/**
 * KIE 异步任务看门狗 · 策略（生图/音频/视频等 callback 型，与厂商慢无关，重点防「通道漏收口」）。
 */
import type { GatewayRequestKind } from "@prisma/client";

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

function parseCheckpointSec(envName: string, fallback: string): number[] {
  const raw = process.env[envName]?.trim() || fallback;
  const out = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const sorted = [...new Set(out)].sort((a, b) => a - b);
  return sorted.length > 0 ? sorted : fallback.split(",").map(Number);
}

/** 生图/TRYON 等短任务：默认 45s / 90s / 180s / 300s */
export function kieWatchdogImageCheckpointSec(): number[] {
  return parseCheckpointSec(
    "GATEWAY_KIE_WATCHDOG_IMAGE_CHECKPOINTS_SEC",
    "45,90,180,300",
  );
}

/** KIE 视频：默认 120s / 300s / 600s / 900s */
export function kieWatchdogVideoCheckpointSec(): number[] {
  return parseCheckpointSec(
    "GATEWAY_KIE_WATCHDOG_VIDEO_CHECKPOINTS_SEC",
    "120,300,600,900",
  );
}

export function kieWatchdogCheckpointSec(
  requestKind: GatewayRequestKind | string | null | undefined,
): number[] {
  return requestKind === "VIDEO"
    ? kieWatchdogVideoCheckpointSec()
    : kieWatchdogImageCheckpointSec();
}

export function kieWatchdogWorkerStaleMs(): number {
  return envInt("GATEWAY_KIE_WATCHDOG_WORKER_STALE_MS", 45 * 1000);
}

export function kieWatchdogPollStaleMinAgeMs(): number {
  return envInt("GATEWAY_KIE_WATCHDOG_POLL_STALE_MIN_AGE_MS", 75 * 1000);
}

export function kieWatchdogRecoverGapMs(): number {
  return envInt("GATEWAY_KIE_WATCHDOG_RECOVER_GAP_MS", 30 * 1000);
}

export function kieWatchdogIntervalMs(): number {
  return envInt("GATEWAY_KIE_WATCHDOG_INTERVAL_MS", 60 * 1000);
}

export function kieWatchdogLimit(): number {
  return envInt("GATEWAY_KIE_WATCHDOG_LIMIT", 12);
}

export function kieWatchdogMinRunIntervalMs(): number {
  return envInt("GATEWAY_KIE_WATCHDOG_MIN_INTERVAL_MS", 15 * 1000);
}

/** 通道连续失败多少次后强制 FAILED（凭证/网络/自调用等） */
export function kieWatchdogChannelFailMax(): number {
  return envInt("GATEWAY_KIE_WATCHDOG_CHANNEL_FAIL_MAX", 5);
}

/** 通道失败最短累计时长（ms）后才强制 FAILED */
export function kieWatchdogChannelFailMinAgeMs(): number {
  return envInt("GATEWAY_KIE_WATCHDOG_CHANNEL_FAIL_MIN_AGE_MS", 3 * 60 * 1000);
}

/** 软上限：仅触发强制 vendor 复核，**不**因厂商仍 in-flight 而 fail */
export function kieWatchdogSoftMaxAgeMs(
  requestKind: GatewayRequestKind | string | null | undefined,
): number {
  if (requestKind === "VIDEO") {
    return envInt("GATEWAY_KIE_WATCHDOG_VIDEO_SOFT_MAX_AGE_MS", 45 * 60 * 1000);
  }
  return envInt("GATEWAY_KIE_WATCHDOG_IMAGE_SOFT_MAX_AGE_MS", 12 * 60 * 1000);
}

/** 硬上限：vendor 复核仍 in-flight 时才 STALE_TIMEOUT fail */
export function kieWatchdogHardMaxAgeMs(
  requestKind: GatewayRequestKind | string | null | undefined,
): number {
  if (requestKind === "VIDEO") {
    return envInt("GATEWAY_KIE_WATCHDOG_VIDEO_HARD_MAX_AGE_MS", 90 * 60 * 1000);
  }
  return envInt("GATEWAY_KIE_WATCHDOG_IMAGE_HARD_MAX_AGE_MS", 30 * 60 * 1000);
}

/** @deprecated 使用 soft/hard 双阈值 */
export function kieWatchdogMaxAgeMs(
  requestKind: GatewayRequestKind | string | null | undefined,
): number {
  return kieWatchdogHardMaxAgeMs(requestKind);
}

export function kieWatchdogOrphanMaxAgeMs(): number {
  return envInt("GATEWAY_KIE_WATCHDOG_ORPHAN_MAX_AGE_MS", 3 * 60 * 1000);
}

export type KieWatchdogChannelMeta = {
  consecutiveVendorFailures?: number;
  consecutiveDbFailures?: number;
  /** @deprecated 读 vendor/db 分计数 */
  consecutiveFailures?: number;
  lastError?: string;
  lastErrorAt?: string;
  lastVendorState?: string;
  lastVendorStateAt?: string;
};

function readFailureCounts(meta: KieWatchdogChannelMeta): {
  vendor: number;
  db: number;
} {
  const vendor =
    meta.consecutiveVendorFailures ??
    meta.consecutiveFailures ??
    0;
  const db = meta.consecutiveDbFailures ?? 0;
  return { vendor, db };
}

export function readKieWatchdogChannelMeta(
  resultSummary: unknown,
): KieWatchdogChannelMeta {
  if (!resultSummary || typeof resultSummary !== "object") return {};
  const gw = (resultSummary as Record<string, unknown>)._gateway;
  if (!gw || typeof gw !== "object") return {};
  const raw = (gw as Record<string, unknown>).kieWatchdogChannel;
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const meta: KieWatchdogChannelMeta = {
    consecutiveVendorFailures:
      typeof o.consecutiveVendorFailures === "number"
        ? o.consecutiveVendorFailures
        : typeof o.consecutiveFailures === "number"
          ? o.consecutiveFailures
          : 0,
    consecutiveDbFailures:
      typeof o.consecutiveDbFailures === "number" ? o.consecutiveDbFailures : 0,
    consecutiveFailures:
      typeof o.consecutiveFailures === "number" ? o.consecutiveFailures : undefined,
    lastError: typeof o.lastError === "string" ? o.lastError : undefined,
    lastErrorAt: typeof o.lastErrorAt === "string" ? o.lastErrorAt : undefined,
    lastVendorState:
      typeof o.lastVendorState === "string" ? o.lastVendorState : undefined,
    lastVendorStateAt:
      typeof o.lastVendorStateAt === "string" ? o.lastVendorStateAt : undefined,
  };
  return meta;
}

export function readKieWatchdogFailureCounts(
  resultSummary: unknown,
): { vendor: number; db: number } {
  return readFailureCounts(readKieWatchdogChannelMeta(resultSummary));
}

export function attachKieWatchdogChannelMeta(
  existing: unknown,
  patch: KieWatchdogChannelMeta,
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
  const prev = readKieWatchdogChannelMeta(base);
  gateway.kieWatchdogChannel = {
    ...prev,
    ...patch,
  };
  base._gateway = gateway;
  return base;
}
