import { SiteHomeV2Chrome } from "@/components/site-home-v2/site-home-v2-chrome";

/** 订阅 / API 价格页：V2 顶栏 + 沿用 site-home 定价样式区 */
export function SiteHomeV2PricingShell({
  children,
  isLoggedIn,
  authSlot,
}: {
  children: React.ReactNode;
  isLoggedIn: boolean;
  authSlot: React.ReactNode;
}) {
  return (
    <SiteHomeV2Chrome
      isLoggedIn={isLoggedIn}
      authSlot={authSlot}
      siteHomeBody
      shellClassName="home-v2-pricing-shell"
      bodyClassName="home-v2-pricing-body"
    >
      {children}
    </SiteHomeV2Chrome>
  );
}
