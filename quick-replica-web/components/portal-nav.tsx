"use client";

import {
  FederatedPortalNav,
  type PortalKey,
  type PortalNavVariant,
} from "@private/federated-portal-nav";
import { getMainSiteOrigin } from "@/lib/site-origin";

export type { PortalKey };

export function PortalNav({
  current = "quick-replica",
  variant = "quick-replica",
  bookOrigin,
  className,
}: {
  current?: PortalKey;
  variant?: PortalNavVariant;
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
