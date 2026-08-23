import type { PortalKey } from "@private/federated-portal-nav";
import {
  buildPortalNavItems,
  type PortalNavItem,
} from "@private/federated-portal-nav";

import { buildBookPortalOpenPageHref } from "@/lib/platform-portal-entry";

export type { PortalNavItem };

/** 过滤掉未配置 origin 的条目后 href 必然存在，调用方可直接用作链接 */
export type BookPortalNavItem = PortalNavItem & { href: string };

/** 主站「产品」菜单跳转子站 / SSO，统一新标签打开 */
export const BOOK_PORTAL_EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

const PORTAL_DEFAULT_REDIRECT: Partial<Record<PortalKey, string>> = {
  canvas: "/projects",
  tool: "/fitting-room",
};

export function marketingHomeSectionUrl(
  origin: string,
  hash: string,
): string {
  const base = origin.replace(/\/$/, "");
  const fragment = hash.startsWith("#") ? hash : `#${hash}`;
  return `${base}/${fragment}`;
}

export function resolveBookOrigin(): string | null {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const raw =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.BOOK_MALL_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/** 主站顶栏「产品」与各子站 federated 菜单共用条目 */
export function buildBookPortalNavItems(
  bookOrigin?: string | null,
  loggedIn = false,
): BookPortalNavItem[] {
  const origin = bookOrigin ?? resolveBookOrigin();
  const items = buildPortalNavItems(origin).filter(
    (item): item is BookPortalNavItem => Boolean(item.href),
  );
  if (!loggedIn) return items;
  return items.map((item) => {
    const redirect = PORTAL_DEFAULT_REDIRECT[item.key] ?? "/";
    const openHref = buildBookPortalOpenPageHref(item.key, redirect);
    return openHref ? { ...item, href: openHref } : item;
  });
}
