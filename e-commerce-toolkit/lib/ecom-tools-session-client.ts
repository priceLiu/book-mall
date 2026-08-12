"use client";

export type EcomToolsSessionClientInfo = {
  hasCookie: boolean;
  active: boolean;
  tokenExpiresAt?: number | null;
  introspect?: unknown;
};

let inflightLite: Promise<EcomToolsSessionClientInfo> | null = null;
let inflightFull: Promise<EcomToolsSessionClientInfo> | null = null;
let refreshInflight: Promise<boolean> | null = null;

async function fetchSession(url: string): Promise<EcomToolsSessionClientInfo> {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as {
    hasCookie?: boolean;
    active?: boolean;
    tokenExpiresAt?: number | null;
    introspect?: unknown;
  };
  return {
    hasCookie: Boolean(data.hasCookie),
    active: Boolean(data.active),
    tokenExpiresAt:
      typeof data.tokenExpiresAt === "number" ? data.tokenExpiresAt : null,
    introspect: data.introspect,
  };
}

/** 心跳用：仅 JWT 过期判断，不阻塞在 introspect */
export function fetchEcomToolsSessionLite(): Promise<EcomToolsSessionClientInfo> {
  if (!inflightLite) {
    inflightLite = fetchSession("/api/tools-session?lite=1").finally(() => {
      inflightLite = null;
    });
  }
  return inflightLite;
}

/** 积分等需要 introspect 时再调用 */
export function fetchEcomToolsSessionFull(): Promise<EcomToolsSessionClientInfo> {
  if (!inflightFull) {
    inflightFull = fetchSession("/api/tools-session").finally(() => {
      inflightFull = null;
    });
  }
  return inflightFull;
}

/** 浏览器侧静默续签 ecom tools_token */
export async function refreshEcomToolsSessionClient(): Promise<boolean> {
  if (refreshInflight) return refreshInflight;

  refreshInflight = (async () => {
    try {
      const r = await fetch("/api/tools-session/refresh", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!r.ok) return false;
      const data = (await r.json().catch(() => null)) as {
        active?: boolean;
      } | null;
      if (data?.active) {
        window.dispatchEvent(new CustomEvent("ecom:tools-session-refreshed"));
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshInflight = null;
    }
  })();

  return refreshInflight;
}
