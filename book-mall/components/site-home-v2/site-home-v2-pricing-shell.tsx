import { CookieConsentBanner } from "@/components/layout/cookie-consent-banner";
import { NavbarAuth } from "@/components/layout/navbar-auth";
import { SiteHomeV2Nav } from "@/components/site-home-v2/site-home-v2-nav";
import { SiteHomeV2Root } from "@/components/site-home-v2/site-home-v2-root";

/** 订阅 / API 价格页：V2 顶栏 + 沿用 site-home 定价样式区 */
export function SiteHomeV2PricingShell({
  children,
  isLoggedIn,
}: {
  children: React.ReactNode;
  isLoggedIn: boolean;
}) {
  return (
    <SiteHomeV2Root>
      <div data-site-home-v2 className="home-v2-pricing-shell min-h-screen">
        <SiteHomeV2Nav
          isLoggedIn={isLoggedIn}
          authSlot={<NavbarAuth appearance="site-home-v2" />}
        />
        <div data-site-home className="home-v2-pricing-body min-h-screen overflow-x-clip">
          {children}
        </div>
        <CookieConsentBanner />
      </div>
    </SiteHomeV2Root>
  );
}
