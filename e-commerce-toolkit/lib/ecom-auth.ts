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

import { getEcomRuntimeBookOrigin } from "@/lib/ecom-runtime-config";

/** 浏览器侧主站地址（须配置 NEXT_PUBLIC_BOOK_MALL_URL） */
export function getBookOriginClient(): string {
  const runtime = getEcomRuntimeBookOrigin();
  if (runtime) return runtime;
  const raw =
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim() ||
    process.env.MAIN_SITE_ORIGIN?.trim();
  return raw || "http://localhost:3000";
}

/**
 * 门户登录：统一跳转 Book 登录（经 re-enter 回子应用）。
 */
export { buildEcomLoginUrl, buildEcomRegisterUrl } from "@/lib/portal-auth-links";

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
