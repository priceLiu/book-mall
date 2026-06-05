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
 * 经主站 Book SSO 登录并回到工具站指定路径。
 * 使用 /ecom-open 过渡页，避免直接打开 re-enter 出现空白页。
 */
export function buildEcomLoginUrl(returnPath = "/"): string {
  const book = getBookOriginClient();
  const path = returnPath.startsWith("/") ? returnPath : `/${returnPath}`;
  return `${book}/ecom-open?path=${encodeURIComponent(path)}`;
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
