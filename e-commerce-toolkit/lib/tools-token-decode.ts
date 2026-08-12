/** 从 tools_token JWT 本地解码展示字段（不验签；仅用于壳层 UI，敏感操作仍走 introspect）。 */

export type ToolsTokenProfile = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  expiresAt: number | null;
};

function decodeSegment(segment: string): Record<string, unknown> | null {
  try {
    let b = segment.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const parsed = JSON.parse(Buffer.from(b, "base64").toString("utf8")) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function decodeToolsTokenProfile(token: string | null | undefined): ToolsTokenProfile | null {
  const raw = token?.trim();
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;

  const payload = decodeSegment(parts[1]!);
  if (!payload) return null;

  const exp = typeof payload.exp === "number" ? payload.exp : null;
  if (exp != null && exp * 1000 <= Date.now()) return null;

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  if (!userId) return null;

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const phone =
    typeof payload.phone === "string" && payload.phone.trim()
      ? payload.phone.trim()
      : null;
  const name =
    (typeof payload.name === "string" && payload.name.trim()) ||
    email.split("@")[0] ||
    "用户";
  const avatarUrl =
    typeof payload.image === "string" && /^https?:\/\//i.test(payload.image.trim())
      ? payload.image.trim()
      : null;

  return {
    userId,
    name,
    email: email || "—",
    phone,
    avatarUrl,
    expiresAt: exp,
  };
}
