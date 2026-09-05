import { getMainSiteOrigin } from "@/lib/site-origin";

/** 门户无头认证 BFF：转发 Book 登录/注册/短信，不重写认证逻辑。 */
export function portalBookOrigin(): string | null {
  return getMainSiteOrigin();
}

export function portalServerSecret(): string | null {
  const s = process.env.TOOLS_SSO_SERVER_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

function applyPlatformClientIp(headers: Record<string, string>, request?: Request): void {
  if (!request) return;
  const xf = request.headers.get("x-forwarded-for");
  const first = xf?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  const ip = (first || real || "").slice(0, 45);
  if (ip) headers["x-platform-client-ip"] = ip;
}

export async function forwardToBook(
  path: string,
  init: {
    method: "POST";
    body: unknown;
    withServerSecret?: boolean;
    clientRequest?: Request;
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
  }
  applyPlatformClientIp(headers, init.clientRequest);
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
