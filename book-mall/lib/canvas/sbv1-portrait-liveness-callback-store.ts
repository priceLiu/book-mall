/**
 * 真人人像 H5 活体 · CallbackURL 回写缓存（进程内 TTL）
 * 火山 H5 完成后跳转 CallbackURL 并携带 resultCode / bytedToken。
 */

export type Sbv1PortraitLivenessCallbackRecord = {
  bytedToken: string;
  resultCode?: string;
  receivedAt: string;
};

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, Sbv1PortraitLivenessCallbackRecord>();

function pruneExpired(now = Date.now()): void {
  for (const [key, row] of store.entries()) {
    if (now - new Date(row.receivedAt).getTime() > TTL_MS) {
      store.delete(key);
    }
  }
}

export function saveSbv1PortraitLivenessCallback(
  bytedToken: string,
  resultCode: string | undefined,
): void {
  const token = bytedToken.trim();
  if (!token) return;
  pruneExpired();
  store.set(token, {
    bytedToken: token,
    resultCode: resultCode?.trim() || undefined,
    receivedAt: new Date().toISOString(),
  });
}

export function getSbv1PortraitLivenessCallback(
  bytedToken: string,
): Sbv1PortraitLivenessCallbackRecord | null {
  pruneExpired();
  return store.get(bytedToken.trim()) ?? null;
}
