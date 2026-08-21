/**
 * 从 tools_token JWT 解析 Book userId（payload.sub）。
 * 仅用于访问统计等非鉴权场景；不验签，但校验 exp。
 */

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const segment = parts[1];
  if (!segment) return null;

  try {
    let b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json =
      typeof atob === "function"
        ? atob(b64)
        : Buffer.from(b64, "base64").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** 读取 request cookies 中的 tools_token 并解析 sub（Book User.id）。 */
export function resolveToolsTokenUserId(cookies: {
  get(name: string): { value: string } | undefined;
}): string | null {
  const raw = cookies.get("tools_token")?.value?.trim();
  if (!raw) return null;

  const payload = decodeJwtPayload(raw);
  if (!payload) return null;

  const exp = typeof payload.exp === "number" ? payload.exp : null;
  if (exp != null && exp * 1000 <= Date.now()) return null;

  const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
  return sub || null;
}
