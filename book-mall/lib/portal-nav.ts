import {
  buildPortalNavItems,
  type PortalNavItem,
} from "@private/federated-portal-nav";

export type { PortalNavItem };

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
export function buildBookPortalNavItems(bookOrigin?: string | null): PortalNavItem[] {
  const origin = bookOrigin ?? resolveBookOrigin();
  return buildPortalNavItems(origin).filter(
    (item): item is PortalNavItem & { href: string } => Boolean(item.href),
  );
}
