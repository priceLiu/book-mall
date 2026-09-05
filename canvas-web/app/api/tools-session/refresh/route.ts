import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";
import { fetchToolsSessionUncachedWithDiag } from "@/lib/tools-introspect";
import { shouldRefreshToolsJwt } from "@/lib/tools-jwt-exp";

export const dynamic = "force-dynamic";

function toolsServerSecret(): string | null {
  const s = process.env.TOOLS_SSO_SERVER_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

function decodeJwtSub(token: string): string | null {
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(
        parts[1].replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf8"),
    ) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

async function refreshFromBookMall(
  request: NextRequest,
  existingToken: string | null,
): Promise<
  | { token: string; expiresIn: number }
  | { error: string; code?: string; status: number }
> {
  const base = getBookMallBaseUrlServer();
  if (!base) {
    return { error: "book_mall_url_missing", status: 503 };
  }

  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const secret = toolsServerSecret();
  const userId = existingToken ? decodeJwtSub(existingToken) : null;
  if (secret && userId) {
    headers.set("Authorization", `Bearer ${secret}`);
    headers.set("Content-Type", "application/json");
    const r = await fetch(`${base.replace(/\/$/, "")}/api/sso/tools/refresh-token`, {
      method: "POST",
      headers,
      body: JSON.stringify({ userId }),
      cache: "no-store",
    });
    if (r.ok) {
      const data = (await r.json().catch(() => null)) as {
        access_token?: string;
        expires_in?: number;
      } | null;
      if (typeof data?.access_token === "string" && data.access_token) {
        return {
          token: data.access_token,
          expiresIn:
            typeof data.expires_in === "number" && data.expires_in > 0
              ? data.expires_in
              : 600,
        };
      }
    }
    // server-secret 换票失败（如 DB 瞬时不可用）时 fall through，用 JWT/cookie 续签
  }

  const bearerHeaders = new Headers();
  if (cookie) bearerHeaders.set("cookie", cookie);
  if (existingToken) {
    bearerHeaders.set("Authorization", `Bearer ${existingToken}`);
  }

  const r = await fetch(`${base.replace(/\/$/, "")}/api/sso/tools/refresh-token`, {
    method: "POST",
    headers: bearerHeaders,
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as {
      error?: string;
      code?: string;
    } | null;
    return {
      error: err?.error ?? "refresh_failed",
      code: err?.code,
      status: r.status,
    };
  }
  const data = (await r.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;
  if (typeof data?.access_token !== "string" || !data.access_token) {
    return { error: "refresh_failed", status: 502 };
  }
  return {
    token: data.access_token,
    expiresIn:
      typeof data.expires_in === "number" && data.expires_in > 0
        ? data.expires_in
        : 600,
  };
}

/** POST：静默续签 tools_token 并写 Cookie */
export async function POST(request: NextRequest) {
  const existing = cookies().get("tools_token")?.value?.trim() ?? null;

  // 令牌仍有效且距过期尚早：仅 introspect 确认会话，避免每 90s 都打 refresh-token
  if (existing && !shouldRefreshToolsJwt(existing)) {
    const { session } = await fetchToolsSessionUncachedWithDiag(existing);
    if (session.active) {
      return NextResponse.json({ active: true, refreshed: false });
    }
  }

  const refreshed = await refreshFromBookMall(request, existing);
  if ("error" in refreshed) {
    return NextResponse.json(
      {
        active: false,
        refreshed: false,
        error: refreshed.error,
        ...(refreshed.code ? { code: refreshed.code } : {}),
      },
      { status: refreshed.status >= 400 ? refreshed.status : 401 },
    );
  }

  // 刚换票成功即视为 active；勿因 introspect 慢/超时把续签误判为失败（会误弹「令牌过期」）
  const res = NextResponse.json({
    active: true,
    refreshed: true,
    hasCookie: true,
  });
  res.cookies.set("tools_token", refreshed.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: refreshed.expiresIn,
  });
  return res;
}
