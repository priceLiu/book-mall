/** story-open / canvas-open 的 `path` query：仅允许绝对路径，防开放重定向 */
export function sanitizeAppRedirectPath(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (raw == null) return fallback;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  return t;
}
