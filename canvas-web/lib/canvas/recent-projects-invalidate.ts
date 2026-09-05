/**
 * 「最近项目」刷新信号 · 门户静态快照不包含此区块，须始终走实时 API。
 * 分享 / 发布成功后调用，返回首页时主动 refetch。
 */
const STALE_KEY = "canvas:recent-projects-stale";
export const RECENT_PROJECTS_INVALIDATE_EVENT = "canvas:recent-projects-invalidate";

export function markRecentProjectsStale(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STALE_KEY, String(Date.now()));
  } catch {
    // ignore quota / private mode
  }
  window.dispatchEvent(new CustomEvent(RECENT_PROJECTS_INVALIDATE_EVENT));
}

export function consumeRecentProjectsStale(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!sessionStorage.getItem(STALE_KEY)) return false;
    sessionStorage.removeItem(STALE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function isRecentProjectsStale(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(sessionStorage.getItem(STALE_KEY));
  } catch {
    return false;
  }
}

export function subscribeRecentProjectsInvalidate(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(RECENT_PROJECTS_INVALIDATE_EVENT, listener);
  return () => window.removeEventListener(RECENT_PROJECTS_INVALIDATE_EVENT, listener);
}
