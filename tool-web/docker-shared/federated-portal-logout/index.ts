import { NextResponse, type NextRequest } from "next/server";

function appendSsoReenterSuppressCookie(res: { headers: Headers }): void {
  const secure = process.env.NODE_ENV === "production";
  const parts = ["sso_reenter_suppress=1", "Path=/", "Max-Age=300", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  res.headers.append("Set-Cookie", parts.join("; "));
}

/** 登出后回跳：优先 returnTo（当前页），否则子站首页。 */
function resolvePortalLogoutReturnUrl(
  request: NextRequest,
  appPublicOrigin: string | null,
): string {
  const base = (appPublicOrigin?.trim() || request.nextUrl.origin).replace(
    /\/$/,
    "",
  );
  const raw = request.nextUrl.searchParams.get("returnTo")?.trim();
  if (!raw) return `${base}/`;

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return `${base}${raw}`;
  }

  try {
    const u = new URL(raw);
    if (u.origin.replace(/\/$/, "") === new URL(`${base}/`).origin.replace(/\/$/, "")) {
      return u.toString();
    }
  } catch {
    /* invalid URL */
  }

  return `${base}/`;
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
  const returnUrl = resolvePortalLogoutReturnUrl(request, opts.appPublicOrigin);
  const book = opts.mainSiteOrigin?.trim().replace(/\/$/, "") ?? "";
  const target = book
    ? new URL(
        `/api/auth/full-signout?callbackUrl=${encodeURIComponent(returnUrl)}`,
        book,
      )
    : new URL(returnUrl);

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
  const returnTo =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/";
  const url = new URL(logoutPath, window.location.origin);
  if (returnTo && returnTo !== "/") {
    url.searchParams.set("returnTo", returnTo);
  }
  window.location.href = url.toString();
}

export {
  appendSsoReenterSuppressCookie,
  createPortalLogoutResponse as default,
};
