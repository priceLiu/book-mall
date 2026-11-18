import { HomeV2NavAuthSlot } from "@/components/layout/home-v2-nav-auth-slot";
import { SiteHomeV2PricingShell } from "@/components/site-home-v2/site-home-v2-pricing-shell";
import "../../site-home-v2.css";

export const dynamic = "force-dynamic";

export default async function PricingRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteHomeV2PricingShell authSlot={<HomeV2NavAuthSlot />}>
      {children}
    </SiteHomeV2PricingShell>
  );
}
