/**
 * Gen-HotCold-R3 · Gateway 控制台轮询策略（对齐 canvas nextPollIntervalMs）。
 *
 * 无在飞 / 无预警 / 无后台等待 → 停止轮询（intervalMs = 0）。
 */
export const GATEWAY_LIVE_POLL_ACTIVE_MS = 8_000;
export const GATEWAY_LIVE_POLL_STALE_MS = 15_000;
export const GATEWAY_SUMMARY_POLL_ACTIVE_MS = 20_000;
/** 无在飞时仍定期全量同步 live 热区，剔除已过期终态行 */
export const GATEWAY_LIVE_HOT_SYNC_MS = 60_000;

export type GatewayDynamicActivityCounts = {
  inProgress: number;
  slowWarn: number;
  backgroundWait: number;
};

export function hasGatewayDynamicActivity(
  counts: GatewayDynamicActivityCounts,
): boolean {
  return (
    counts.inProgress > 0 ||
    counts.slowWarn > 0 ||
    counts.backgroundWait > 0
  );
}

/** 列表层在飞（与 stats 计数叠加，避免 stats 短暂漂移时仍停轮询）。 */
export function shouldGatewayLivePoll(
  counts: GatewayDynamicActivityCounts,
  listHasInFlight: boolean,
): boolean {
  return hasGatewayDynamicActivity(counts) || listHasInFlight;
}

export function gatewayLivePollIntervalMs(
  counts: GatewayDynamicActivityCounts,
  listHasInFlight: boolean,
  stale = false,
): number {
  if (stale) return GATEWAY_LIVE_POLL_STALE_MS;
  if (!shouldGatewayLivePoll(counts, listHasInFlight)) return 0;
  return GATEWAY_LIVE_POLL_ACTIVE_MS;
}

export function gatewaySummaryPollIntervalMs(
  counts: GatewayDynamicActivityCounts,
): number {
  if (!hasGatewayDynamicActivity(counts)) return 0;
  return GATEWAY_SUMMARY_POLL_ACTIVE_MS;
}
