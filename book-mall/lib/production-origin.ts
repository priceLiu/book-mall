/** 生产环境公网 canonical，与自定义域 DNS 一致；开发环境不使用。 */

export const PRODUCTION_MAIN_SITE_ORIGIN = "https://book.ai-code8.com";
export const PRODUCTION_TOOL_SITE_ORIGIN = "https://tool.ai-code8.com";

function isTencentCloudRunDefaultHost(host: string): boolean {
  return host.toLowerCase().endsWith(".sh.run.tcloudbase.com");
}

/** 显式设为 `1` 时保留云托管默认网关域名（预发 / 特殊排障）。 */
export function allowCloudbaseDefaultOrigins(): boolean {
  return process.env.ALLOW_CLOUDBASE_DEFAULT_ORIGINS?.trim() === "1";
}

export function isProductionAiCode8Host(host: string): boolean {
  const h = host.toLowerCase();
  return h === "ai-code8.com" || h.endsWith(".ai-code8.com");
}

/** 从代理头解析请求协议（CloudBase / CDN 前置 TLS 时常见 x-forwarded-proto）。 */
export function incomingRequestProto(
  protoHeader: string | null,
  fallbackProto: string,
  forwardedHeader?: string | null,
): "http" | "https" {
  if (forwardedHeader) {
    const first = forwardedHeader.split(",")[0] ?? "";
    const m = first.match(/(?:^|;\s*)proto=(https?)/i);
    if (m?.[1]?.toLowerCase() === "https") return "https";
    if (m?.[1]?.toLowerCase() === "http") return "http";
  }
  if (protoHeader) {
    const first = protoHeader.split(",")[0]?.trim().toLowerCase();
    if (first === "http" || first === "https") return first;
  }
  const p = fallbackProto.replace(":", "").toLowerCase();
  return p === "https" ? "https" : "http";
}

export function incomingHostFromHeaders(h: Headers): string {
  const xf = h.get("x-forwarded-host");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("host") ?? "";
}

/** 服务端组件 / Route：若当前请求为 HTTP，返回应对应的 HTTPS 绝对 URL。 */
export function productionHttpsRedirectUrlFromHeaders(
  h: Headers,
  pathname: string,
  search: string,
): string | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (allowCloudbaseDefaultOrigins()) return null;
  const host = incomingHostFromHeaders(h);
  const proto = incomingRequestProto(
    h.get("x-forwarded-proto"),
    "http:",
    h.get("forwarded"),
  );
  if (!shouldEnforceProductionHttps(host, proto)) return null;
  return `https://${host.toLowerCase()}${pathname}${search}`;
}

/** 未登录跳转登录页：始终用 canonical HTTPS，避免 http 页 + Secure Cookie 无法登录。 */
export function buildBookMallLoginRedirectUrl(
  callbackPath: string,
  callbackSearch = "",
): string {
  const login = new URL("/login", PRODUCTION_MAIN_SITE_ORIGIN);
  const cb = callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
  login.searchParams.set("callbackUrl", `${cb}${callbackSearch}`);
  return login.toString();
}

/**
 * 生产自定义域须走 HTTPS：NextAuth 会话 Cookie 为 Secure，HTTP 页无法写入会话（公网登录失败）。
 */
export function shouldEnforceProductionHttps(host: string, proto: string): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (allowCloudbaseDefaultOrigins()) return false;
  if (!isProductionAiCode8Host(host)) return false;
  return proto !== "https";
}

/** 生产 `*.ai-code8.com` 一律纠正为 https origin（控制台误填 http:// 时）。 */
export function canonicalizeProductionOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (
      process.env.NODE_ENV === "production" &&
      !allowCloudbaseDefaultOrigins() &&
      isProductionAiCode8Host(u.hostname) &&
      u.protocol === "http:"
    ) {
      u.protocol = "https:";
    }
    return u.origin;
  } catch {
    return null;
  }
}

function patchProductionOriginEnv(key: string, canon: string): void {
  const raw = process.env[key]?.trim();
  if (!raw) {
    process.env[key] = canon;
    return;
  }
  try {
    const u = new URL(raw);
    if (isTencentCloudRunDefaultHost(u.hostname)) {
      process.env[key] = canon;
      return;
    }
    if (isProductionAiCode8Host(u.hostname) && u.protocol === "http:") {
      u.protocol = "https:";
      process.env[key] = u.origin;
    }
  } catch {
    /* 保持原样 */
  }
}

/**
 * 生产环境下将仍为腾讯云默认域、留空或误填 http:// 的变量纠正为 book / tool 正式 HTTPS 域名，
 * 使 NextAuth 登出跳转、SSO 签发与诊断与浏览器自定义域一致。
 * `pnpm dev` 下不执行。
 */
export function applyBookMallProductionOriginDefaults(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (allowCloudbaseDefaultOrigins()) return;

  patchProductionOriginEnv("NEXTAUTH_URL", PRODUCTION_MAIN_SITE_ORIGIN);
  patchProductionOriginEnv("TOOLS_PUBLIC_ORIGIN", PRODUCTION_TOOL_SITE_ORIGIN);
}
