import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 自定义全量登出：清理 NextAuth 所有可能的 Cookie 变体（host-only + 共享域）。
 *
 * 背景：升级到 `NEXTAUTH_COOKIE_DOMAIN=.ai-code8.com` 后，浏览器里仍残留升级前
 * 签发的 host-only `__Secure-next-auth.session-token` / `__Host-next-auth.csrf-token`。
 * NextAuth 自带的 signOut 只按当前配置清新版 Cookie，旧 Cookie 不会被清，导致
 * 「正常模式点了退出还是登录态、无痕模式正常」的现象。
 *
 * 实现要点：浏览器把 (name, domain, path) 视作不同 Cookie——
 * 同名但 domain 不同的 host-only / 共享域 Cookie 必须用 **多条同名 Set-Cookie**
 * 分别清。`NextResponse.cookies.set` 内部按 name 去重，会把 host-only 的 Set-Cookie
 * 覆盖成共享域版，所以这里改为手动 `headers.append('Set-Cookie', ...)`。
 */

const SESSION_COOKIE_NAMES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

const CSRF_COOKIE_NAMES = [
  "__Host-next-auth.csrf-token",
  "__Secure-next-auth.csrf-token",
  "next-auth.csrf-token",
];

const CALLBACK_COOKIE_NAMES = [
  "__Secure-next-auth.callback-url",
  "next-auth.callback-url",
];

const PKCE_COOKIE_NAMES = [
  "__Secure-next-auth.pkce.code_verifier",
  "next-auth.pkce.code_verifier",
];

const STATE_COOKIE_NAMES = [
  "__Secure-next-auth.state",
  "next-auth.state",
];

function sharedDomain(): string | undefined {
  const d = process.env.NEXTAUTH_COOKIE_DOMAIN?.trim();
  return d || undefined;
}

function buildClearingCookieHeader(
  name: string,
  domain: string | undefined,
  secure: boolean,
): string {
  /** `__Host-` 前缀按规范禁止 Domain；只能按 host-only 清。 */
  const isHostPrefix = name.startsWith("__Host-");
  const parts = [
    `${name}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    "SameSite=Lax",
  ];
  if (!isHostPrefix && domain) parts.push(`Domain=${domain}`);
  if (secure || name.startsWith("__Secure-") || isHostPrefix) parts.push("Secure");
  parts.push("HttpOnly");
  return parts.join("; ");
}

function safeRedirectTarget(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

async function handle(request: NextRequest): Promise<NextResponse> {
  /**
   * 用相对路径作 Location，让浏览器按当前请求的 origin 解析。
   * CloudBase Run 容器里 `request.nextUrl.origin` 会是内部 0.0.0.0:3000，
   * 用绝对 URL 重定向会跳到无法访问的地址。
   */
  const callbackUrl = safeRedirectTarget(
    request.nextUrl.searchParams.get("callbackUrl"),
  );
  const res = new NextResponse(null, {
    status: 302,
    headers: {
      Location: callbackUrl,
      "Cache-Control": "no-store",
    },
  });

  const secure = process.env.NODE_ENV === "production";
  const domain = sharedDomain();

  const allNames = [
    ...SESSION_COOKIE_NAMES,
    ...CSRF_COOKIE_NAMES,
    ...CALLBACK_COOKIE_NAMES,
    ...PKCE_COOKIE_NAMES,
    ...STATE_COOKIE_NAMES,
  ];

  for (const name of allNames) {
    /** host-only（升级前默认）；__Host- 前缀强制按此清。 */
    res.headers.append(
      "Set-Cookie",
      buildClearingCookieHeader(name, undefined, secure),
    );
    /** 共享域（升级后默认）；__Host- 跳过。 */
    if (domain && !name.startsWith("__Host-")) {
      res.headers.append(
        "Set-Cookie",
        buildClearingCookieHeader(name, domain, secure),
      );
    }
  }

  return res;
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
