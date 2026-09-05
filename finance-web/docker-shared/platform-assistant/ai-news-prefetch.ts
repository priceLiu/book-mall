/** AI 小智 · 热闻预取缓存（全站 layout mount 共享）。 */

export type PrefetchedAiNews = {
  content: string;
  dateKey: string;
  stale?: boolean;
  generatedAt?: string;
};

let prefetched: PrefetchedAiNews | null = null;
let inflight: Promise<PrefetchedAiNews | null> | null = null;

export function getPrefetchedAiNews(): PrefetchedAiNews | null {
  return prefetched;
}

export function clearPrefetchedAiNewsForTests() {
  prefetched = null;
  inflight = null;
}

/** layout mount 时调用；未登录 401 时静默跳过。 */
export function prefetchAiNews(newsEndpoint: string): Promise<PrefetchedAiNews | null> {
  if (prefetched) return Promise.resolve(prefetched);
  if (inflight) return inflight;

  inflight = fetch(newsEndpoint, { credentials: "include", cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as PrefetchedAiNews & { error?: string };
      if (!data.content?.trim()) return null;
      prefetched = {
        content: data.content.trim(),
        dateKey: data.dateKey,
        stale: data.stale,
        generatedAt: data.generatedAt,
      };
      return prefetched;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
