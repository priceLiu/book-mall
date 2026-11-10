import { getServerSession } from "next-auth";

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
    <SiteHomeV2PricingShell isLoggedIn={Boolean(session?.user)}>
      {children}
    </SiteHomeV2PricingShell>
  );
}
