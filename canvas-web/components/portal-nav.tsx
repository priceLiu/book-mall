"use client";

import {
  FederatedPortalNav,
  type PortalKey,
} from "@private/federated-portal-nav";

export type { PortalKey };

export function PortalNav({
  current = "canvas",
  bookOrigin,
}: {
  current?: PortalKey;
  bookOrigin: string | null;
}) {
  return (
    <FederatedPortalNav
      current={current}
      bookOrigin={bookOrigin}
      variant="canvas"
    />
  );
}
