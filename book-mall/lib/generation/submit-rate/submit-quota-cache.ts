import type { GenerationSubmitTier } from "@prisma/client";

export type CachedSubmitQuota = {
  burstLimit: number;
  tier: GenerationSubmitTier | null;
  version: number;
  expiresAt: number;
};

const SUBMIT_QUOTA_CACHE_TTL_MS = 60_000;
const cache = new Map<string, CachedSubmitQuota>();

export function getCachedSubmitQuota(scopeKey: string): CachedSubmitQuota | null {
  const now = Date.now();
  const hit = cache.get(scopeKey);
  if (!hit || hit.expiresAt <= now) {
    if (hit) cache.delete(scopeKey);
    return null;
  }
  return hit;
}

export function setCachedSubmitQuota(
  scopeKey: string,
  value: Omit<CachedSubmitQuota, "expiresAt">,
): void {
  cache.set(scopeKey, {
    ...value,
    expiresAt: Date.now() + SUBMIT_QUOTA_CACHE_TTL_MS,
  });
}

export function invalidateSubmitQuotaCache(scopeKeys?: string | string[]): void {
  if (!scopeKeys) {
    cache.clear();
    return;
  }
  const keys = Array.isArray(scopeKeys) ? scopeKeys : [scopeKeys];
  for (const key of keys) cache.delete(key);
}
