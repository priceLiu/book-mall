/** API 返回 401 / 未登录 */
export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;

  constructor(message = "未登录") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function isUnauthorizedError(err: unknown): boolean {
  return (
    err instanceof UnauthorizedError ||
    (err instanceof Error &&
      (err.message.includes("未登录") || err.message.includes("tools_session_inactive")))
  );
}

let runtimeBookOrigin: string | null = null;

export function setRuntimeBookOrigin(origin: string) {
  runtimeBookOrigin = origin.replace(/\/$/, "");
}

export function getBookOriginClient(): string {
  if (runtimeBookOrigin) return runtimeBookOrigin;
  const raw =
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim() ||
    process.env.MAIN_SITE_ORIGIN?.trim();
  return raw || "http://localhost:3000";
}

export function buildLoginUrl(returnPath = "/"): string {
  const origin = getBookOriginClient();
  const path = returnPath.startsWith("/") ? returnPath : `/${returnPath}`;
  return `${origin.replace(/\/$/, "")}/login?redirect=${encodeURIComponent(
    `${getAppOpenRedirect(path)}`,
  )}`;
}

function getAppOpenRedirect(path: string): string {
  const appOrigin =
    process.env.NEXT_PUBLIC_COMMON_TOOLS_ORIGIN?.trim() ||
    process.env.COMMON_TOOLS_PUBLIC_ORIGIN?.trim() ||
    "http://localhost:3010";
  return `${appOrigin.replace(/\/$/, "")}${path}`;
}

export function throwIfUnauthorized(res: Response, data: Record<string, unknown>): void {
  if (res.status !== 401) return;
  const err =
    typeof data.error === "string"
      ? data.error
      : typeof data.message === "string"
        ? data.message
        : "未登录";
  throw new UnauthorizedError(err);
}
