/** 独立工具站 SSO 环境变量（主站与工具站服务端共用密钥时需同步部署配置） */

/**
 * 纠正控制台常见误填：`https://host/:3001`（端口写在 path）→ `https://host:3001`。
 * 云上网关通常只需 `https://host`，勿带路径形式的端口。
 */
function normalizeHttpOriginUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const m = u.pathname.match(/^\/:(\d+)\/?$/);
    if (m && !u.port) {
      u.port = m[1];
      u.pathname = "/";
    }
    return u;
  } catch {
    return null;
  }
}

/**
 * 生产环境若 `TOOLS_PUBLIC_ORIGIN` 仍误填云托管默认域（*.sh.run.tcloudbase.com），
 * 且 `NEXTAUTH_URL` 已为自定义主站 `https://book.*`，则签发 SSO 时回落到同协议、
 * 同父域的 `https://tool.*`，避免从主站跳进默认网关 URL。
 * 仍建议在控制台将 `TOOLS_PUBLIC_ORIGIN` 显式改为用户访问的工具站 origin。
 */
export function getToolsPublicOrigin(): string | null {
  const raw = process.env.TOOLS_PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  const u = normalizeHttpOriginUrl(raw);
  if (!u) return null;

  if (
    process.env.NODE_ENV === "production" &&
    u.hostname.endsWith(".sh.run.tcloudbase.com")
  ) {
    const main = normalizeHttpOriginUrl(process.env.NEXTAUTH_URL?.trim() ?? "");
    if (
      main &&
      !main.hostname.endsWith(".sh.run.tcloudbase.com") &&
      main.hostname.startsWith("book.")
    ) {
      const toolHost = `tool.${main.hostname.slice("book.".length)}`;
      const derived = `${main.protocol}//${toolHost}`;
      if (process.env.TOOLS_DIAGNOSTICS === "1") {
        console.warn(
          "[sso-tools-env] TOOLS_PUBLIC_ORIGIN is CloudBase default host; deriving tools origin from NEXTAUTH_URL:",
          derived,
        );
      }
      return derived;
    }
  }

  return u.origin;
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

/** 用于后台 UI：逐项说明为何 SSO 未就绪（不涉及密钥明文）。 */
export function getToolsSsoSetupDiagnostics(): { ready: boolean; issues: string[] } {
  const issues: string[] = [];

  const rawOrigin = process.env.TOOLS_PUBLIC_ORIGIN?.trim();
  const origin = getToolsPublicOrigin();
  if (!rawOrigin) {
    issues.push(
      "未设置 TOOLS_PUBLIC_ORIGIN（本地示例：http://127.0.0.1:3001 ，须含协议、无末尾 /）",
    );
  } else if (!origin) {
    issues.push(
      "TOOLS_PUBLIC_ORIGIN 无法解析为有效 http(s) URL（请检查是否漏写 http:// 或拼写错误）",
    );
  } else if (rawOrigin) {
    try {
      const rawHost = normalizeHttpOriginUrl(rawOrigin)?.hostname ?? "";
      if (
        rawHost.endsWith(".sh.run.tcloudbase.com") &&
        process.env.NODE_ENV === "production"
      ) {
        const main = normalizeHttpOriginUrl(process.env.NEXTAUTH_URL?.trim() ?? "");
        const canDerive =
          !!main &&
          !main.hostname.endsWith(".sh.run.tcloudbase.com") &&
          main.hostname.startsWith("book.");
        if (!canDerive) {
          issues.push(
            `TOOLS_PUBLIC_ORIGIN 仍指向云托管默认域（${rawHost}）；生产环境请改为用户实际打开工具站的 HTTPS 自定义域（如 https://tool.ai-code8.com），须可与 NEXTAUTH_URL（book.*）配对。`,
          );
        }
      }
    } catch {
      /* ignore */
    }
  }

  const server = process.env.TOOLS_SSO_SERVER_SECRET?.trim();
  if (!server) {
    issues.push(
      "未设置 TOOLS_SSO_SERVER_SECRET（≥16 字符；须与 tool-web/.env.local 内完全一致）",
    );
  } else if (server.length < 16) {
    issues.push("TOOLS_SSO_SERVER_SECRET 长度不足 16 字符");
  }

  const jwt = process.env.TOOLS_SSO_JWT_SECRET?.trim();
  if (!jwt) {
    issues.push("未设置 TOOLS_SSO_JWT_SECRET（≥16 字符随机串）");
  } else if (jwt.length < 16) {
    issues.push("TOOLS_SSO_JWT_SECRET 长度不足 16 字符");
  }

  return { ready: issues.length === 0, issues };
}

export function isToolsSsoConfigured(): boolean {
  return getToolsSsoSetupDiagnostics().ready;
}
