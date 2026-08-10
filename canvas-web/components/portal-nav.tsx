"use client";

import {
  FederatedPortalNav,
  type PortalKey,
} from "@private/federated-portal-nav";
import { getMainSiteOrigin } from "@/lib/site-origin";

export type { PortalKey };

export function PortalNav({ current = "canvas" }: { current?: PortalKey }) {
  return (
    <FederatedPortalNav
      current={current}
      bookOrigin={getMainSiteOrigin()}
      variant="canvas"
    />
  );
}
