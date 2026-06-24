/** 交通控流 · 用户可见耗时锚点（自动重排不重置） */

export const TRAFFIC_STARTED_AT_PAYLOAD_KEY = "trafficStartedAt";

export function readTrafficStartedAtMs(
  payload: Record<string, unknown> | null | undefined,
  fallback: Date | string,
): number {
  const raw = payload?.[TRAFFIC_STARTED_AT_PAYLOAD_KEY];
  if (typeof raw === "string" && raw.trim()) {
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) return ms;
  }
  const fbMs =
    fallback instanceof Date ? fallback.getTime() : Date.parse(String(fallback));
  return Number.isFinite(fbMs) ? fbMs : Date.now();
}

export function readTrafficStartedAtIso(
  payload: Record<string, unknown> | null | undefined,
  fallback: Date | string,
): string {
  return new Date(readTrafficStartedAtMs(payload, fallback)).toISOString();
}

/** 首次入队时写入 payload；已有则保留（自愈重排不覆盖） */
export function withTrafficStartedAtPayload(
  payload: Record<string, unknown> | null | undefined,
  startedAtMs = Date.now(),
): Record<string, unknown> {
  const base = payload && typeof payload === "object" ? { ...payload } : {};
  if (
    typeof base[TRAFFIC_STARTED_AT_PAYLOAD_KEY] === "string" &&
    base[TRAFFIC_STARTED_AT_PAYLOAD_KEY].trim()
  ) {
    return base;
  }
  return {
    ...base,
    [TRAFFIC_STARTED_AT_PAYLOAD_KEY]: new Date(startedAtMs).toISOString(),
  };
}
