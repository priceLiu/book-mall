import type { NextRequest } from "next/server";
import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";

export type ProxyToolsTokenRefresh = {
  accessToken: string;
  expiresIn: number;
};

const REFRESH_FETCH_TIMEOUT_MS = (() => {
  const v = Number(process.env.TOOLS_TOKEN_REFRESH_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : 12_000;
})();

let refreshInflight: Promise<ProxyToolsTokenRefresh | null> | null = null;
let refreshInflightKey = "";

function toolsServerSecret(): string | null {
  const s = process.env.TOOLS_SSO_SERVER_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

export function decodeJwtSub(token: string): string | null {
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

function isJwtExpired(token: string, skewSec = 30): boolean {
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(
      Buffer.from(
        parts[1].replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf8"),
    ) as { exp?: unknown };
    if (typeof payload.exp !== "number") return true;
    return payload.exp * 1000 <= Date.now() + skewSec * 1000;
  } catch {
    return true;
  }
}

async function fetchRefreshToken(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REFRESH_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callBookMallRefreshTokenOnce(
  request: NextRequest,
  bearer: string | null,
  userId?: string | null,
): Promise<ProxyToolsTokenRefresh | null> {
  const base = getBookMallBaseUrlServer();
  if (!base) return null;

  const headers = new Headers({ "Content-Type": "application/json" });
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const secret = toolsServerSecret();
  if (secret && userId) {
    headers.set("Authorization", `Bearer ${secret}`);
    const r = await fetchRefreshToken(
      `${base.replace(/\/$/, "")}/api/sso/tools/refresh-token`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ userId }),
        cache: "no-store",
      },
    );
    if (r.ok) {
      const data = (await r.json().catch(() => null)) as {
        access_token?: string;
        expires_in?: number;
      } | null;
      if (typeof data?.access_token === "string" && data.access_token) {
        return {
          accessToken: data.access_token,
          expiresIn:
            typeof data.expires_in === "number" && data.expires_in > 0
              ? data.expires_in
              : 600,
        };
      }
    }
  }

  if (bearer) {
    headers.set("Authorization", `Bearer ${bearer}`);
  }
  headers.delete("Content-Type");

  const r = await fetchRefreshToken(
    `${base.replace(/\/$/, "")}/api/sso/tools/refresh-token`,
    {
      method: "POST",
      headers,
      cache: "no-store",
    },
  );
  if (!r.ok) return null;
  const data = (await r.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;
  if (typeof data?.access_token !== "string" || !data.access_token) return null;
  return {
    accessToken: data.access_token,
    expiresIn:
      typeof data.expires_in === "number" && data.expires_in > 0
        ? data.expires_in
        : 600,
  };
}

export async function callBookMallRefreshToken(
  request: NextRequest,
  bearer: string | null,
  userId?: string | null,
): Promise<ProxyToolsTokenRefresh | null> {
  const key = userId?.trim() || bearer?.slice(-24) || "cookie";
  if (refreshInflight && refreshInflightKey === key) {
    return refreshInflight;
  }
  refreshInflightKey = key;
  refreshInflight = callBookMallRefreshTokenOnce(request, bearer, userId).finally(
    () => {
      if (refreshInflightKey === key) {
        refreshInflight = null;
        refreshInflightKey = "";
      }
    },
  );
  return refreshInflight;
}

/** BFF 代理前确保有可用 Bearer：cookie 过期则静默 refresh。 */
export async function ensureProxyToolsBearer(
  request: NextRequest,
): Promise<{
  bearer: string | null;
  refreshed: ProxyToolsTokenRefresh | null;
}> {
  const existing = request.cookies.get("tools_token")?.value?.trim() ?? null;
  if (existing && !isJwtExpired(existing)) {
    return { bearer: existing, refreshed: null };
  }

  const userId = existing ? decodeJwtSub(existing) : null;
  const refreshed = await callBookMallRefreshToken(request, existing, userId);
  if (refreshed) {
    return { bearer: refreshed.accessToken, refreshed };
  }

  return { bearer: existing, refreshed: null };
}
