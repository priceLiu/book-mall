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
): "http" | "https" {
  if (protoHeader) {
    const first = protoHeader.split(",")[0]?.trim().toLowerCase();
    if (first === "http" || first === "https") return first;
  }
  const p = fallbackProto.replace(":", "").toLowerCase();
  return p === "https" ? "https" : "http";
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

/**
 * 生产环境下将仍为腾讯云默认域或留空的变量纠正为 book / tool 正式域名，
 * 使 NextAuth 登出跳转、SSO 签发与诊断与浏览器自定义域一致。
 * `pnpm dev` 下不执行。
 */
export function applyBookMallProductionOriginDefaults(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (allowCloudbaseDefaultOrigins()) return;

  const patch = (key: string, canon: string) => {
    const raw = process.env[key]?.trim();
    if (!raw) {
      process.env[key] = canon;
      return;
    }
    try {
      const host = new URL(raw).hostname;
      if (isTencentCloudRunDefaultHost(host)) {
        process.env[key] = canon;
      }
    } catch {
      /* 保持原样 */
    }
  };

  patch("NEXTAUTH_URL", PRODUCTION_MAIN_SITE_ORIGIN);
  patch("TOOLS_PUBLIC_ORIGIN", PRODUCTION_TOOL_SITE_ORIGIN);
}
