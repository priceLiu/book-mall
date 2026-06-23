/**
 * 与 book-mall `gateway-hot-window.ts` 对齐：live 热区 = 在飞 + completedAt 近 1h。
 * 前端用于剔除已过期仍留在列表缓存中的终态行。
 */
export const GATEWAY_LOG_HOT_RETENTION_MS = 3_600_000;

export function gatewayLogHotCutoffMs(nowMs = Date.now()): number {
  return nowMs - GATEWAY_LOG_HOT_RETENTION_MS;
}

export function isLogInLiveHotWindow(
  row: { status: string; completedAt: string | null },
  hotCutoffMs = gatewayLogHotCutoffMs(),
): boolean {
  if (row.status === "PENDING" || row.status === "RUNNING") return true;
  if (!row.completedAt) return false;
  const completedMs = Date.parse(row.completedAt);
  return Number.isFinite(completedMs) && completedMs >= hotCutoffMs;
}

export function filterLiveHotWindowRows<
  T extends { status: string; completedAt: string | null },
>(rows: T[], hotCutoffMs = gatewayLogHotCutoffMs()): T[] {
  return rows.filter((r) => isLogInLiveHotWindow(r, hotCutoffMs));
}
