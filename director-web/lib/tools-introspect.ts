import { getMainSiteOrigin } from "@/lib/site-origin";

export type ToolsIntrospectPayload = Record<string, unknown> | null;

export type FetchToolsSessionResult = {
  hasCookie: boolean;
  originConfigured: boolean;
  introspectStatus: number | null;
  introspect: ToolsIntrospectPayload;
  active: boolean;
};

function normalizeBearer(token: string | undefined): string | undefined {
  if (typeof token !== "string") return undefined;
  const t = token.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * 3D导演台为纯前端编辑器（无受保护后端 / 无 Gateway），会话仅用于「是否已登录」展示。
 * 直接向主站 introspect 查询 token 状态。
 */
export async function fetchToolsSession(
  token: string | undefined,
): Promise<FetchToolsSessionResult> {
  const bearer = normalizeBearer(token);
  const origin = getMainSiteOrigin();
  const originConfigured = Boolean(origin);

  if (!bearer) {
    return {
      hasCookie: typeof token === "string" && token.trim().length > 0,
      originConfigured,
      introspectStatus: null,
      introspect: null,
      active: false,
    };
  }

  if (!origin) {
    return {
      hasCookie: true,
      originConfigured: false,
      introspectStatus: null,
      introspect: null,
      active: false,
    };
  }

  const timeoutMsRaw = process.env.TOOLS_INTROSPECT_TIMEOUT_MS?.trim();
  const timeoutMs =
    timeoutMsRaw && /^\d+$/.test(timeoutMsRaw)
      ? Math.min(Math.max(Number(timeoutMsRaw), 3000), 60000)
      : 12000;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let r: Response;
  try {
    r = await fetch(`${origin}/api/sso/tools/introspect`, {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: "no-store",
      signal: ac.signal,
    });
  } catch {
    clearTimeout(timer);
    return {
      hasCookie: true,
      originConfigured,
      introspectStatus: null,
      introspect: null,
      active: false,
    };
  }
  clearTimeout(timer);

  const introspect = (await r.json().catch(() => null)) as ToolsIntrospectPayload;
  const active =
    introspect != null &&
    typeof introspect === "object" &&
    introspect.active === true;

  return {
    hasCookie: true,
    originConfigured,
    introspectStatus: r.status,
    introspect,
    active,
  };
}
