import { TOOLS_TOKEN_COOKIE_NAME } from "@/lib/clear-tools-token-cookie";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant/context";
import { SESSION_KICK_COOKIE } from "@/lib/session-kick-cookie";

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
  opts: { domain?: string; secure: boolean },
): string {
  const isHostPrefix = name.startsWith("__Host-");
  const parts = [
    `${name}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    "SameSite=Lax",
  ];
  if (!isHostPrefix && opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.secure || name.startsWith("__Secure-") || isHostPrefix) parts.push("Secure");
  parts.push("HttpOnly");
  return parts.join("; ");
}

function buildClearingPublicCookieHeader(name: string, opts: { domain?: string; secure: boolean }): string {
  const parts = [
    `${name}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    "SameSite=Lax",
  ];
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * 生成清除 Book 会话相关 Cookie 的全部 Set-Cookie 头。
 * 须用 headers.append 逐条写入（NextResponse.cookies.set 会按 name 去重覆盖 host-only / 域 Cookie）。
 */
export function buildClearSessionCookieHeaders(): string[] {
  const headers: string[] = [];
  const productionSecure = process.env.NODE_ENV === "production";
  const domain = sharedDomain();
  const localhostDomains =
    process.env.NODE_ENV !== "production" ? ["localhost", ".localhost"] : [];

  const allNames = [
    ...SESSION_COOKIE_NAMES,
    ...CSRF_COOKIE_NAMES,
    ...CALLBACK_COOKIE_NAMES,
    ...PKCE_COOKIE_NAMES,
    ...STATE_COOKIE_NAMES,
  ];

  for (const name of allNames) {
    for (const secure of productionSecure ? [true] : [false, true]) {
      headers.push(buildClearingCookieHeader(name, { secure }));
    }
    if (domain && !name.startsWith("__Host-")) {
      for (const secure of productionSecure ? [true] : [false, true]) {
        headers.push(buildClearingCookieHeader(name, { domain, secure }));
      }
    }
    for (const localhostDomain of localhostDomains) {
      if (name.startsWith("__Host-")) continue;
      for (const secure of [false, true]) {
        headers.push(
          buildClearingCookieHeader(name, { domain: localhostDomain, secure }),
        );
      }
    }
  }

  for (const secure of productionSecure ? [true] : [false, true]) {
    headers.push(
      buildClearingPublicCookieHeader(TOOLS_TOKEN_COOKIE_NAME, { secure }),
    );
    headers.push(
      buildClearingPublicCookieHeader(ACTIVE_TENANT_COOKIE, { secure }),
    );
    headers.push(
      buildClearingPublicCookieHeader(SESSION_KICK_COOKIE, { secure }),
    );
  }
  for (const localhostDomain of localhostDomains) {
    for (const secure of [false, true]) {
      headers.push(
        buildClearingPublicCookieHeader(TOOLS_TOKEN_COOKIE_NAME, {
          domain: localhostDomain,
          secure,
        }),
      );
      headers.push(
        buildClearingPublicCookieHeader(ACTIVE_TENANT_COOKIE, {
          domain: localhostDomain,
          secure,
        }),
      );
      headers.push(
        buildClearingPublicCookieHeader(SESSION_KICK_COOKIE, {
          domain: localhostDomain,
          secure,
        }),
      );
    }
  }

  return headers;
}

export function appendClearSessionCookieHeaders(headers: Headers): void {
  for (const h of buildClearSessionCookieHeaders()) {
    headers.append("Set-Cookie", h);
  }
}
