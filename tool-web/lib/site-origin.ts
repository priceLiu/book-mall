/** 主站 Origin（无末尾 `/`），用于服务端调用 introspect。 */
export function getMainSiteOrigin(): string | null {
  const raw = process.env.MAIN_SITE_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return raw.replace(/\/$/, "");
  } catch {
    return null;
  }
}
