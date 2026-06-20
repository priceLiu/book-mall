/** Gateway 日志 / 状态驾驶舱 · 分页参数（与 logs-table 一致） */

export const GATEWAY_LOG_PAGE_SIZE_PRESETS = [20, 50, 100] as const;
export const GATEWAY_LOG_PAGE_SIZE_DEFAULT = GATEWAY_LOG_PAGE_SIZE_PRESETS[0];
export const GATEWAY_LOG_PAGE_SIZE_MAX = 500;
export const GATEWAY_LOG_PAGE_SIZE_STORAGE_KEY = "gw-logs-page-size";

export type GatewayLogPageSizePreset =
  | (typeof GATEWAY_LOG_PAGE_SIZE_PRESETS)[number]
  | "custom";

export function readStoredGatewayLogPageSize(): number {
  if (typeof window === "undefined") return GATEWAY_LOG_PAGE_SIZE_DEFAULT;
  try {
    const raw = window.localStorage.getItem(GATEWAY_LOG_PAGE_SIZE_STORAGE_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n <= GATEWAY_LOG_PAGE_SIZE_MAX) {
      return Math.floor(n);
    }
  } catch {
    /* ignore */
  }
  return GATEWAY_LOG_PAGE_SIZE_DEFAULT;
}

export function persistGatewayLogPageSize(size: number) {
  try {
    window.localStorage.setItem(GATEWAY_LOG_PAGE_SIZE_STORAGE_KEY, String(size));
  } catch {
    /* ignore */
  }
}

export function clampGatewayLogPageSize(value: number): number {
  if (!Number.isFinite(value) || value < 1) return GATEWAY_LOG_PAGE_SIZE_DEFAULT;
  return Math.min(GATEWAY_LOG_PAGE_SIZE_MAX, Math.floor(value));
}

export function resolveGatewayLogPageSizePreset(
  size: number,
): GatewayLogPageSizePreset {
  return GATEWAY_LOG_PAGE_SIZE_PRESETS.includes(
    size as (typeof GATEWAY_LOG_PAGE_SIZE_PRESETS)[number],
  )
    ? (size as (typeof GATEWAY_LOG_PAGE_SIZE_PRESETS)[number])
    : "custom";
}
