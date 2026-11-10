import { getServerSession } from "next-auth";

import { NavbarAuth } from "@/components/layout/navbar-auth";
import { SiteHomeV2PricingShell } from "@/components/site-home-v2/site-home-v2-pricing-shell";
import { authOptions } from "@/lib/auth";
import "../../site-home-v2.css";

export const dynamic = "force-dynamic";

export default async function PricingRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <SiteHomeV2PricingShell
      isLoggedIn={Boolean(session?.user)}
      authSlot={<NavbarAuth appearance="site-home-v2" />}
    >
      {children}
    </SiteHomeV2PricingShell>
  );
}
