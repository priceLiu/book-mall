/** `redirect` query：仅允许站内路径，防开放重定向 */
export function sanitizeToolsRedirectPath(
  raw: string | null | undefined,
): string {
  const fallback = "/fitting-room";
  if (raw == null) return fallback;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  return t;
}
