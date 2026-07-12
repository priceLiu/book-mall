/** API 返回 401 / 未登录 */
export class EcomUnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;

  constructor(message = "未登录") {
    super(message);
    this.name = "EcomUnauthorizedError";
  }
}

export function isEcomUnauthorizedError(err: unknown): boolean {
  return (
    err instanceof EcomUnauthorizedError ||
    (err instanceof Error &&
      (err.message.includes("未登录") || err.message.includes("tools_session_inactive")))
  );
}

/** 浏览器侧主站地址（须配置 NEXT_PUBLIC_BOOK_MALL_URL） */
export function getBookOriginClient(): string {
  const raw =
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim() ||
    process.env.MAIN_SITE_ORIGIN?.trim();
  return raw || "http://localhost:3000";
}

/**
 * 门户独立登录：跳本域品牌登录页（携带回跳），不再直接弹主站。
 * 已有 Book 会话的用户由 `silentEcomSessionRefresh`（隐藏 iframe re-enter）无感续期，
 * 无 Book 会话者在本域品牌页完成登录/注册。
 */
export function buildEcomLoginUrl(returnPath = "/"): string {
  const path = returnPath.startsWith("/") ? returnPath : `/${returnPath}`;
  return `/login?redirect=${encodeURIComponent(path)}`;
}

export function throwIfUnauthorized(res: Response, data: Record<string, unknown>): void {
  if (res.status !== 401) return;
  const err =
    typeof data.error === "string"
      ? data.error
      : typeof data.message === "string"
        ? data.message
        : "未登录";
  throw new EcomUnauthorizedError(err);
}
