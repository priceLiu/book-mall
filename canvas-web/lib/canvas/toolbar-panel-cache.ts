/**
 * 画布顶栏侧栏 · 首屏列表内存缓存（减轻每次打开面板都打库）。
 * 仅缓存第一页（默认 20 条）；变更事件可 invalidate。
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export function toolbarPanelCacheKey(
  panel: string,
  parts: Record<string, string | number | null | undefined> = {},
): string {
  const bits = Object.entries(parts)
    .filter(([, v]) => v != null && String(v).length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return `${panel}|${bits.join("&")}`;
}

export function readToolbarPanelCache<T>(
  key: string,
  ttlMs = DEFAULT_TTL_MS,
): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > ttlMs) {
    store.delete(key);
    return null;
  }
  return hit.data as T;
}

/** 未 force 且缓存有效时返回数据，供面板首屏跳过网络请求 */
export function peekToolbarPanelCache<T>(
  key: string,
  opts?: { force?: boolean; ttlMs?: number },
): T | null {
  if (opts?.force) return null;
  return readToolbarPanelCache<T>(key, opts?.ttlMs);
}

export function writeToolbarPanelCache<T>(key: string, data: T): void {
  store.set(key, { data, fetchedAt: Date.now() });
}

export function invalidateToolbarPanelCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function invalidateAllToolbarPanelCache(): void {
  store.clear();
}
