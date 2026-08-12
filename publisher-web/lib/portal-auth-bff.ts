import { getMainSiteOrigin } from "@/lib/site-origin";

export function portalBookOrigin(): string | null {
  return getMainSiteOrigin();
}

export function portalServerSecret(): string | null {
  const s = process.env.TOOLS_SSO_SERVER_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

export async function forwardToBook(
  path: string,
  init: {
    method: "POST";
    body: unknown;
    withServerSecret?: boolean;
    bearerToken?: string | null;
  },
): Promise<
  | { ok: true; status: number; data: Record<string, unknown> }
  | { ok: false; status: number; data: Record<string, unknown> }
> {
  const origin = portalBookOrigin();
  if (!origin) {
    return { ok: false, status: 503, data: { error: "主站未配置（MAIN_SITE_ORIGIN）" } };
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.withServerSecret) {
    const secret = portalServerSecret();
    if (!secret) {
      return {
        ok: false,
        status: 503,
        data: { error: "服务端未配置 TOOLS_SSO_SERVER_SECRET" },
      };
    }
    headers.Authorization = `Bearer ${secret}`;
  } else if (init.bearerToken?.trim()) {
    headers.Authorization = `Bearer ${init.bearerToken.trim()}`;
  }
  let res: Response;
  try {
    res = await fetch(`${origin}${path}`, {
      method: init.method,
      headers,
      body: JSON.stringify(init.body ?? {}),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, data: { error: "无法连接主站认证服务" } };
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return res.ok
    ? { ok: true, status: res.status, data }
    : { ok: false, status: res.status, data };
}
