/** 生产环境公网 canonical；开发环境不使用。 */

export const PRODUCTION_MAIN_SITE_ORIGIN = "https://book.ai-code8.com";
export const PRODUCTION_TOOL_SITE_ORIGIN = "https://tool.ai-code8.com";

function isTencentCloudRunDefaultHost(host: string): boolean {
  return host.toLowerCase().endsWith(".sh.run.tcloudbase.com");
}

export function allowCloudbaseDefaultOrigins(): boolean {
  return process.env.ALLOW_CLOUDBASE_DEFAULT_ORIGINS?.trim() === "1";
}

/** 生产环境：纠正 MAIN_SITE_ORIGIN / TOOLS_PUBLIC_ORIGIN 的默认网关域或空值。 */
export function applyToolWebProductionOriginDefaults(): void {
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

  patch("MAIN_SITE_ORIGIN", PRODUCTION_MAIN_SITE_ORIGIN);
  patch("TOOLS_PUBLIC_ORIGIN", PRODUCTION_TOOL_SITE_ORIGIN);
}
