/** 生产环境公网 canonical；开发环境不使用。 */

export const PRODUCTION_MAIN_SITE_ORIGIN = "https://book.ai-code8.com";
export const PRODUCTION_TOOL_SITE_ORIGIN = "https://tool.ai-code8.com";

function isTencentCloudRunDefaultHost(host: string): boolean {
  return host.toLowerCase().endsWith(".sh.run.tcloudbase.com");
}

export function allowCloudbaseDefaultOrigins(): boolean {
  return process.env.ALLOW_CLOUDBASE_DEFAULT_ORIGINS?.trim() === "1";
}

export function isProductionAiCode8Host(host: string): boolean {
  const h = host.toLowerCase();
  return h === "ai-code8.com" || h.endsWith(".ai-code8.com");
}

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

export function shouldEnforceProductionHttps(host: string, proto: string): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (allowCloudbaseDefaultOrigins()) return false;
  if (!isProductionAiCode8Host(host)) return false;
  return proto !== "https";
}

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

/** 生产环境：纠正 MAIN_SITE_ORIGIN / TOOLS_PUBLIC_ORIGIN 的默认网关域、空值或 http:// 误填。 */
export function applyToolWebProductionOriginDefaults(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (allowCloudbaseDefaultOrigins()) return;

  patchProductionOriginEnv("MAIN_SITE_ORIGIN", PRODUCTION_MAIN_SITE_ORIGIN);
  patchProductionOriginEnv("TOOLS_PUBLIC_ORIGIN", PRODUCTION_TOOL_SITE_ORIGIN);
}
