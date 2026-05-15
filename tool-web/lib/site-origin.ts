import { applyToolWebProductionOriginDefaults } from "./production-origin";

applyToolWebProductionOriginDefaults();

/** 主站 Origin（无末尾 `/`），用于服务端调用 introspect。 */

/** 与 book-mall `normalizeHttpOriginUrl` 同源：纠正 `https://host/:3000` → `https://host:3000`。 */
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

export function getMainSiteOrigin(): string | null {
  const raw = process.env.MAIN_SITE_ORIGIN?.trim();
  if (!raw) return null;
  const u = normalizeHttpOriginUrl(raw);
  if (!u) return null;
  return u.origin;
}

/**
 * 浏览器访问工具站的 Origin（须与 book-mall `TOOLS_PUBLIC_ORIGIN` **完全一致**）。
 * Docker / 云托管内 `request.nextUrl.origin` 常为 `http://0.0.0.0:3001`，导致 SSO 回调重定向损坏；
 * 生产 **务必** 配置此项；本地可不配，回退为请求的 origin。
 */
export function getToolsSitePublicOrigin(): string | null {
  const raw = process.env.TOOLS_PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  const u = normalizeHttpOriginUrl(raw);
  if (!u) return null;
  return u.origin;
}
