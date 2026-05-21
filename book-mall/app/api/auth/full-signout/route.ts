import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 自定义全量登出：清理 NextAuth 所有可能的 Cookie 变体（host-only + 共享域）。
 *
 * 背景：升级到 `NEXTAUTH_COOKIE_DOMAIN=.ai-code8.com` 后，浏览器里仍残留升级前
 * 签发的 host-only `__Secure-next-auth.session-token` / `__Host-next-auth.csrf-token`。
 * NextAuth 自带的 signOut 只按当前配置清新版 Cookie，旧 Cookie 不会被清，导致
 * 「点了退出还是登录态」的现象。本路由按所有名称 + 域 + 是否安全前缀逐一清空。
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

function clearCookie(
  res: NextResponse,
  name: string,
  domain: string | undefined,
  secure: boolean,
) {
  res.cookies.set({
    name,
    value: "",
    path: "/",
    domain,
    maxAge: 0,
    expires: new Date(0),
    secure,
    httpOnly: true,
    sameSite: "lax",
  });
}

function safeRedirectTarget(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const callbackUrl = safeRedirectTarget(
    request.nextUrl.searchParams.get("callbackUrl"),
  );
  const target = new URL(callbackUrl, request.nextUrl.origin);
  const res = NextResponse.redirect(target, 302);

  const secure = process.env.NODE_ENV === "production";
  const domain = sharedDomain();

  /** host-only（升级前默认）+ 共享域（升级后默认）两种变体都清。 */
  const domainVariants: Array<string | undefined> = [undefined];
  if (domain) domainVariants.push(domain);

  const allNames = [
    ...SESSION_COOKIE_NAMES,
    ...CSRF_COOKIE_NAMES,
    ...CALLBACK_COOKIE_NAMES,
    ...PKCE_COOKIE_NAMES,
    ...STATE_COOKIE_NAMES,
  ];

  for (const name of allNames) {
    for (const d of domainVariants) {
      clearCookie(res, name, d, secure);
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
