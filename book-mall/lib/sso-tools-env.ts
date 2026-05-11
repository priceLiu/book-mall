/** 独立工具站 SSO 环境变量（主站与工具站服务端共用密钥时需同步部署配置） */

export function getToolsPublicOrigin(): string | null {
  const raw = process.env.TOOLS_PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return raw.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function requireToolsSsoServerSecret(): string {
  const s = process.env.TOOLS_SSO_SERVER_SECRET?.trim();
  if (!s || s.length < 16) {
    throw new Error("TOOLS_SSO_SERVER_SECRET missing or too short (min 16 chars)");
  }
  return s;
}

export function requireToolsJwtSecret(): string {
  const s = process.env.TOOLS_SSO_JWT_SECRET?.trim();
  if (!s || s.length < 16) {
    throw new Error("TOOLS_SSO_JWT_SECRET missing or too short (min 16 chars)");
  }
  return s;
}

export function toolsExchangeAuthorized(req: Request): boolean {
  let secret: string;
  try {
    secret = requireToolsSsoServerSecret();
  } catch {
    return false;
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** 授权码有效期（秒），默认 90 */
export function getSsoCodeTtlSec(): number {
  const n = Number(process.env.TOOLS_SSO_CODE_TTL_SECONDS);
  if (Number.isFinite(n) && n >= 30 && n <= 300) return Math.floor(n);
  return 90;
}

/** JWT 有效期（秒），默认 600 */
export function getToolsJwtTtlSec(): number {
  const n = Number(process.env.TOOLS_SSO_JWT_TTL_SECONDS);
  if (Number.isFinite(n) && n >= 120 && n <= 7200) return Math.floor(n);
  return 600;
}

export function isToolsSsoConfigured(): boolean {
  try {
    requireToolsSsoServerSecret();
    requireToolsJwtSecret();
    return Boolean(getToolsPublicOrigin());
  } catch {
    return false;
  }
}
