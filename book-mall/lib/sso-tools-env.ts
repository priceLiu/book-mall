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
 * 浏览器应打开的工具站 Origin（无末尾 `/`），用于 SSO 换票跳转等。
 *
 * 优先级：
 * 1. `TOOLS_SSO_ISSUE_ORIGIN`（可选）— 仅主站读取；当控制台仍留着云托管默认 `TOOLS_PUBLIC_ORIGIN`、
 *    但用户实际访问 `https://tool.ai-code8.com` 时，可单独设此项指向自定义域。
 * 2. `TOOLS_PUBLIC_ORIGIN` + 生产环境下一层推导（自定义域 `book.*`→`tool.*`，或见下）。
 *
 * 仍建议最终将 `TOOLS_PUBLIC_ORIGIN` / `NEXTAUTH_URL` 都改为线上自定义域。
 */
export function getToolsPublicOrigin(): string | null {
  const issueOverride = process.env.TOOLS_SSO_ISSUE_ORIGIN?.trim();
  if (issueOverride) {
    const ou = normalizeHttpOriginUrl(issueOverride);
    if (ou) return ou.origin;
  }

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

  const issueRaw = process.env.TOOLS_SSO_ISSUE_ORIGIN?.trim();
  const rawOrigin = process.env.TOOLS_PUBLIC_ORIGIN?.trim();
  const issueParsed = issueRaw ? normalizeHttpOriginUrl(issueRaw) : null;
  const rawParsed = rawOrigin ? normalizeHttpOriginUrl(rawOrigin) : null;
  const origin = getToolsPublicOrigin();

  if (!rawOrigin && !issueRaw) {
    issues.push(
      "未设置 TOOLS_PUBLIC_ORIGIN（本地示例：http://localhost:3001）；生产也可仅设 TOOLS_SSO_ISSUE_ORIGIN 作为签发用工具站 origin。",
    );
  } else if (rawOrigin && !rawParsed) {
    issues.push(
      "TOOLS_PUBLIC_ORIGIN 无法解析为有效 http(s) URL（请检查是否漏写 http:// 或拼写错误）",
    );
  } else if (issueRaw && !issueParsed) {
    issues.push("TOOLS_SSO_ISSUE_ORIGIN 无法解析为有效 http(s) URL");
  } else if (!origin) {
    issues.push("无法解析最终工具站 origin");
  }

  if (origin && rawParsed) {
    try {
      const rawHost = rawParsed.hostname;
      const resolvedHost = new URL(origin).hostname;
      if (
        rawHost.endsWith(".sh.run.tcloudbase.com") &&
        process.env.NODE_ENV === "production" &&
        resolvedHost.endsWith(".sh.run.tcloudbase.com")
      ) {
        const main = normalizeHttpOriginUrl(process.env.NEXTAUTH_URL?.trim() ?? "");
        const nextAuthIsCustom =
          !!main && !main.hostname.endsWith(".sh.run.tcloudbase.com");
        const nextAuthBookPrefix = !!main && main.hostname.startsWith("book.");
        const haveOverride = !!issueParsed;
        if (!((nextAuthIsCustom && nextAuthBookPrefix) || haveOverride)) {
          issues.push(
            `NEXTAUTH_URL 与 TOOLS_PUBLIC_ORIGIN 仍为云托管默认域（签发结果仍会落在 ${resolvedHost}）。请将 NEXTAUTH_URL 改为 https://book.ai-code8.com、TOOLS_PUBLIC_ORIGIN 改为 https://tool.ai-code8.com；或在主站增设 TOOLS_SSO_ISSUE_ORIGIN=https://tool.ai-code8.com（工具站 env 中 TOOLS_PUBLIC_ORIGIN 须与用户访问域名一致）。`,
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
