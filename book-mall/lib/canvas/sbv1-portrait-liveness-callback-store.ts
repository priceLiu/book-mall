/**
 * 真人人像 H5 活体 · 会话与 CallbackURL 回写缓存（进程内 TTL）
 * 火山 H5 完成后跳转 CallbackURL 并携带 resultCode / bytedToken。
 */

export type Sbv1PortraitLivenessCallbackRecord = {
  bytedToken: string;
  resultCode?: string;
  receivedAt: string;
};

export type Sbv1PortraitLivenessSessionRecord = {
  userId: string;
  bytedToken: string;
  createdAt: string;
};

const TTL_MS = 35 * 60 * 1000;
const callbackStore = new Map<string, Sbv1PortraitLivenessCallbackRecord>();
const sessionStore = new Map<string, Sbv1PortraitLivenessSessionRecord>();

function pruneExpired(now = Date.now()): void {
  for (const [key, row] of callbackStore.entries()) {
    if (now - new Date(row.receivedAt).getTime() > TTL_MS) {
      callbackStore.delete(key);
    }
  }
  for (const [key, row] of sessionStore.entries()) {
    if (now - new Date(row.createdAt).getTime() > TTL_MS) {
      sessionStore.delete(key);
    }
  }
}

export function saveSbv1PortraitLivenessSession(
  userId: string,
  bytedToken: string,
): void {
  const token = bytedToken.trim();
  if (!token || !userId.trim()) return;
  pruneExpired();
  sessionStore.set(token, {
    userId: userId.trim(),
    bytedToken: token,
    createdAt: new Date().toISOString(),
  });
}

export function getSbv1PortraitLivenessSessionOwner(
  bytedToken: string,
): string | null {
  pruneExpired();
  return sessionStore.get(bytedToken.trim())?.userId ?? null;
}

export function saveSbv1PortraitLivenessCallback(
  bytedToken: string,
  resultCode: string | undefined,
): void {
  const token = bytedToken.trim();
  if (!token) return;
  pruneExpired();
  callbackStore.set(token, {
    bytedToken: token,
    resultCode: resultCode?.trim() || undefined,
    receivedAt: new Date().toISOString(),
  });
}

export function getSbv1PortraitLivenessCallback(
  bytedToken: string,
): Sbv1PortraitLivenessCallbackRecord | null {
  pruneExpired();
  return callbackStore.get(bytedToken.trim()) ?? null;
}
