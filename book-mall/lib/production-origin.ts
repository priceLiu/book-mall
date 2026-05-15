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
