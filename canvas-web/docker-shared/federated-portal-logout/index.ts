import { NextResponse, type NextRequest } from "next/server";

function appendSsoReenterSuppressCookie(res: { headers: Headers }): void {
  const secure = process.env.NODE_ENV === "production";
  const parts = ["sso_reenter_suppress=1", "Path=/", "Max-Age=300", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  res.headers.append("Set-Cookie", parts.join("; "));
}

/**
 * 子站门户登出（与 book `/api/auth/full-signout` 联邦链路配套）：
 * 清本域 tools_token → 写 sso_reenter_suppress → 302 到主站 full-signout。
 */
export function createPortalLogoutResponse(
  request: NextRequest,
  opts: {
    appPublicOrigin: string | null;
    mainSiteOrigin: string | null;
  },
): NextResponse {
  const base = opts.appPublicOrigin?.trim() || request.nextUrl.origin;
  const homeUrl = new URL("/", base).toString();
  const book = opts.mainSiteOrigin?.trim().replace(/\/$/, "") ?? "";
  const target = book
    ? new URL(
        `/api/auth/full-signout?callbackUrl=${encodeURIComponent(homeUrl)}`,
        book,
      )
    : new URL("/", base);

  const res = NextResponse.redirect(target);
  res.cookies.set("tools_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  appendSsoReenterSuppressCookie(res);
  return res;
}

/** 退出 / 换账号前写入，避免主站会话仍在时子站立刻静默 re-enter。 */
export function markSsoReenterSuppressed(maxAgeSec = 300): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `sso_reenter_suppress=1; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

export function isSsoReenterSuppressedClient(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)sso_reenter_suppress=1(?:;|$)/.test(document.cookie);
}

/** 客户端统一退出入口（须配合各子站 `/api/auth/logout`）。 */
export function navigatePortalLogout(logoutPath = "/api/auth/logout"): void {
  markSsoReenterSuppressed();
  window.location.href = logoutPath;
}

export {
  appendSsoReenterSuppressCookie,
  createPortalLogoutResponse as default,
};
