import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";
import { decodeJwtSub } from "@/lib/book-mall-proxy-auth";
import { fetchToolsSessionUncachedWithDiag } from "@/lib/tools-introspect";

export const dynamic = "force-dynamic";

function toolsServerSecret(): string | null {
  const s = process.env.TOOLS_SSO_SERVER_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

async function refreshFromBookMall(
  request: NextRequest,
  existingToken: string | null,
): Promise<{ token: string; expiresIn: number } | null> {
  const base = getBookMallBaseUrlServer();
  if (!base) return null;

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
  }

  if (existingToken) {
    headers.set("Authorization", `Bearer ${existingToken}`);
  }
  headers.delete("Content-Type");

  const r = await fetch(`${base.replace(/\/$/, "")}/api/sso/tools/refresh-token`, {
    method: "POST",
    headers,
    cache: "no-store",
  });
  if (!r.ok) return null;
  const data = (await r.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;
  if (typeof data?.access_token !== "string" || !data.access_token) return null;
  return {
    token: data.access_token,
    expiresIn:
      typeof data.expires_in === "number" && data.expires_in > 0
        ? data.expires_in
        : 600,
  };
}

/** POST：静默续签 tools_token（使用中 token 过期时无整页跳转） */
export async function POST(request: NextRequest) {
  const existing = cookies().get("tools_token")?.value?.trim() ?? null;
  const { session } = await fetchToolsSessionUncachedWithDiag(existing ?? undefined);
  if (session.active && existing) {
    return NextResponse.json({ active: true, refreshed: false });
  }

  const refreshed = await refreshFromBookMall(request, existing);
  if (!refreshed) {
    return NextResponse.json(
      { active: false, refreshed: false, error: "refresh_failed" },
      { status: 401 },
    );
  }

  const verify = await fetchToolsSessionUncachedWithDiag(refreshed.token);
  const res = NextResponse.json({
    active: verify.session.active,
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
