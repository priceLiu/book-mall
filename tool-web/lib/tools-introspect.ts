import { cache } from "react";
import { getMainSiteOrigin } from "@/lib/site-origin";
import type {
  ToolsSessionFetchDiag,
  ToolsSessionNoBearerDiag,
} from "@/lib/tools-diagnostics";
import { verifyToolsJwt } from "@/lib/tools-jwt";
import { TOOL_SUITE_NAV_KEYS } from "@/lib/tool-suite-nav-keys";

export type ToolsIntrospectPayload = Record<string, unknown> | null;

export type FetchToolsSessionResult = {
  hasCookie: boolean;
  originConfigured: boolean;
  introspectStatus: number | null;
  introspect: ToolsIntrospectPayload;
  active: boolean;
};

export type FetchToolsSessionWithDiag = {
  session: FetchToolsSessionResult;
  diag: ToolsSessionFetchDiag | ToolsSessionNoBearerDiag;
};

function normalizeBearer(token: string | undefined): string | undefined {
  if (typeof token !== "string") return undefined;
  const t = token.trim();
  return t.length > 0 ? t : undefined;
}

function jwtSecretReady(): string | null {
  const s = process.env.TOOLS_SSO_JWT_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

/**
 * 单次 bearer 解析（可测量）；由 cache / uncached 入口包装。
 */
async function fetchToolsSessionCore(bearer: string): Promise<{
  session: FetchToolsSessionResult;
  diag: ToolsSessionFetchDiag;
}> {
  const t0 = performance.now();
  const origin = getMainSiteOrigin();
  const originConfigured = Boolean(origin);

  const secret = jwtSecretReady();
  let msJwtAttempt: number | undefined;

  if (secret) {
    const tJwtStart = performance.now();
    const jwt = verifyToolsJwt(bearer, secret);
    msJwtAttempt = performance.now() - tJwtStart;
    if (jwt) {
      const suiteKeys = [...TOOL_SUITE_NAV_KEYS];
      const memberNeedsHttp =
        jwt.tier !== "admin" &&
        (!jwt.toolsNavKeys || jwt.toolsNavKeys.length === 0);
      if (!memberNeedsHttp) {
        const tools_nav_keys =
          jwt.tier === "admin" ? suiteKeys : (jwt.toolsNavKeys ?? []);
        return {
          session: {
            hasCookie: true,
            originConfigured,
            introspectStatus: 200,
            active: true,
            introspect: {
              active: true,
              sub: jwt.sub,
              tier: jwt.tier,
              tools_role: jwt.tier === "admin" ? "admin" : "member",
              tools_nav_keys,
              email: jwt.email ?? null,
              name: jwt.name ?? null,
              image: jwt.image ?? null,
              exp: jwt.exp,
              session_source: "jwt_local",
              note:
                "本响应来自本地 JWT 验签，未请求 HTTP introspect；余额与实时准入以主站 introspect 或业务 API 为准。",
            },
          },
          diag: {
            path: "jwt_local",
            msJwtAttempt,
            msTotal: performance.now() - t0,
          },
        };
      }
    }
  }

  if (!origin) {
    return {
      session: {
        hasCookie: true,
        originConfigured: false,
        introspectStatus: null,
        introspect: null,
        active: false,
      },
      diag: {
        path: "missing_main_origin",
        msJwtAttempt,
        msTotal: performance.now() - t0,
      },
    };
  }

  const introspectUrl = `${origin}/api/sso/tools/introspect`;
  const timeoutMsRaw = process.env.TOOLS_INTROSPECT_TIMEOUT_MS?.trim();
  const timeoutMs =
    timeoutMsRaw && /^\d+$/.test(timeoutMsRaw)
      ? Math.min(Math.max(Number(timeoutMsRaw), 3000), 60000)
      : 12000;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const tFetchStart = performance.now();
  let r: Response;
  try {
    r = await fetch(introspectUrl, {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: "no-store",
      signal: ac.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const msIntrospectFetch = performance.now() - tFetchStart;
    const aborted =
      e instanceof Error &&
      (e.name === "AbortError" || e.message.includes("aborted"));
    return {
      session: {
        hasCookie: true,
        originConfigured,
        introspectStatus: aborted ? 504 : null,
        introspect: aborted
          ? {
              session_source: "introspect_aborted",
              active: false,
              note: `主站 introspect 在 ${timeoutMs}ms 内未完成（常见于数据库冷启动），请稍后点击「重新连接」或使用 JWT 快路径（配置 TOOLS_SSO_JWT_SECRET）`,
            }
          : null,
        active: false,
      },
      diag: {
        path: aborted ? "introspect_aborted" : "introspect_network_error",
        msJwtAttempt,
        msIntrospectFetch,
        msTotal: performance.now() - t0,
      },
    };
  }
  clearTimeout(timer);

  const msIntrospectFetch = performance.now() - tFetchStart;
  const introspectStatus = r.status;
  const raw = (await r.json().catch(() => null)) as ToolsIntrospectPayload;

  let introspect = raw;
  if (raw && typeof raw === "object" && !("session_source" in raw)) {
    introspect = { ...raw, session_source: "introspect_http" };
  }

  const active =
    introspect != null &&
    typeof introspect === "object" &&
    introspect.active === true;

  return {
    session: {
      hasCookie: true,
      originConfigured,
      introspectStatus,
      introspect,
      active,
    },
    diag: {
      path: "introspect_http",
      msJwtAttempt,
      msIntrospectFetch,
      introspectHttpStatus: introspectStatus,
      msTotal: performance.now() - t0,
    },
  };
}

const cachedFetchToolsSessionCore = cache(fetchToolsSessionCore);

async function fetchToolsSessionCached(bearerKey: string): Promise<FetchToolsSessionResult> {
  const { session } = await cachedFetchToolsSessionCore(bearerKey);
  return session;
}

/**
 * 统一会话拉取：① 配置 `TOOLS_SSO_JWT_SECRET` 且 JWT 有效 → **零 HTTP**（不经主站 DB）；② 否则走主站 introspect。
 * 同一请求内多处调用会去重（React cache；键为 trim 后的 token）。
 */
export async function fetchToolsSession(
  token: string | undefined,
): Promise<FetchToolsSessionResult> {
  const bearer = normalizeBearer(token);
  const hadCookieParam = typeof token === "string" && token.trim().length > 0;

  if (!bearer) {
    return {
      hasCookie: hadCookieParam,
      originConfigured: Boolean(getMainSiteOrigin()),
      introspectStatus: null,
      introspect: null,
      active: false,
    };
  }

  return fetchToolsSessionCached(bearer);
}

/** Route Handler 等场景：勿使用 React cache，避免与 RSC 生命周期耦合 */
export async function fetchToolsSessionUncached(
  token: string | undefined,
): Promise<FetchToolsSessionResult> {
  const bearer = normalizeBearer(token);
  const hadCookieParam = typeof token === "string" && token.trim().length > 0;

  if (!bearer) {
    return {
      hasCookie: hadCookieParam,
      originConfigured: Boolean(getMainSiteOrigin()),
      introspectStatus: null,
      introspect: null,
      active: false,
    };
  }

  const { session } = await fetchToolsSessionCore(bearer);
  return session;
}

/** 供 `/api/tools-session` 输出 Server-Timing / `_diag` */
export async function fetchToolsSessionUncachedWithDiag(
  token: string | undefined,
): Promise<FetchToolsSessionWithDiag> {
  const t0 = performance.now();
  const bearer = normalizeBearer(token);
  const hadCookieParam = typeof token === "string" && token.trim().length > 0;

  if (!bearer) {
    return {
      session: {
        hasCookie: hadCookieParam,
        originConfigured: Boolean(getMainSiteOrigin()),
        introspectStatus: null,
        introspect: null,
        active: false,
      },
      diag: {
        path: "no_bearer",
        msTotal: performance.now() - t0,
      },
    };
  }

  return fetchToolsSessionCore(bearer);
}
