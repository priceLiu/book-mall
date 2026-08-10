"use client";

import {
  FederatedPortalNav,
  buildPortalNavItems as buildSharedPortalNavItems,
  type PortalKey,
} from "@private/federated-portal-nav";
import { getMainSiteOrigin } from "@/lib/site-origin";

export type { PortalKey };

export function buildPortalNavItems(book: string | null = getMainSiteOrigin()) {
  return buildSharedPortalNavItems(book);
}

export function PortalNav({
  current,
  variant = "light",
  bookOrigin,
  className,
}: {
  current: PortalKey;
  variant?: "light" | "dark";
  bookOrigin?: string | null;
  className?: string;
}) {
  return (
    <FederatedPortalNav
      current={current}
      bookOrigin={bookOrigin ?? getMainSiteOrigin()}
      variant={variant}
      className={className}
    />
  );
}
