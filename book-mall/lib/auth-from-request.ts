import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export type RequestAuthClaims = {
  sub: string;
  role?: string;
};

/**
 * 从当前 HTTP 请求的 Cookie 解析 NextAuth JWT（与 App Router Route Handler 收到的 `request` 绑定）。
 * 财务类跨域请求须依赖「浏览器带到 book-mall 的这一份 Cookie」；若仅用 `getServerSession()` 而不绑定
 * 本请求的 cookie 容器，在部分运行时下可能与会话不同步。
 */
export async function getAuthFromRequest(request: NextRequest): Promise<RequestAuthClaims | null> {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) return null;

  try {
    const token = await getToken({
      /** next-auth/jwt 类型仍偏 Pages `IncomingMessage`，App Router 下以运行时支持的 `Headers` + `RequestCookies` 为准。 */
      req: {
        headers: request.headers,
        cookies: request.cookies,
      } as Parameters<typeof getToken>[0]["req"],
      secret,
    });
    if (!token || typeof token !== "object") return null;
    const sub = token.sub;
    if (typeof sub !== "string" || !sub) return null;
    const role = typeof token.role === "string" ? token.role : undefined;
    return { sub, role };
  } catch {
    return null;
  }
}
