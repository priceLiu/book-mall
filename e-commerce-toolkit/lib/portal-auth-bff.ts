import { getMainSiteOrigin } from "@/lib/site-origin";

/**
 * 门户无头认证 BFF 辅助（仅服务端）。电商工具箱不承载认证逻辑，仅转发到 Book：
 * - 登录：Book `POST /api/sso/portal/verify`（Bearer 服务端密钥）
 * - 注册：Book `POST /api/auth/register`
 * - 短信：Book `POST /api/auth/sms/send`
 *
 * TOOLS_SSO_SERVER_SECRET 仅存在于服务端，绝不暴露到浏览器。
 */
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
