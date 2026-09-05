const buckets = new Map<string, number[]>();

export type ShareCodeRateLimitConfig = {
  windowMs: number;
  max: number;
};

export const SHARE_CODE_RESOLVE_RATE_LIMIT: ShareCodeRateLimitConfig = {
  windowMs: 60_000,
  max: 60,
};

export const SHARE_CODE_CLAIM_RATE_LIMIT: ShareCodeRateLimitConfig = {
  windowMs: 60_000,
  max: 20,
};

export function isShareCodeRateLimited(
  key: string,
  limit: ShareCodeRateLimitConfig,
): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < limit.windowMs);
  if (arr.length >= limit.max) {
    buckets.set(key, arr);
    return true;
  }
  arr.push(now);
  buckets.set(key, arr);
  return false;
}

export function shareCodeRateLimitKey(ip: string, action: string): string {
  return `${action}:${ip || "unknown"}`;
}
