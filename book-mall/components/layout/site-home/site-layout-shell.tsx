import { CookieConsentBanner } from "@/components/layout/cookie-consent-banner";
import { SiteHomeNav } from "@/components/layout/site-home/site-home-nav";
import { SiteHomeV2Chrome } from "@/components/site-home-v2/site-home-v2-chrome";
import {
  isAuthFullscreenRoute,
  isHomeV2Route,
  isLegacyHome,
  isPricingRoute,
  prefersSiteHomeBody,
} from "@/lib/site-layout/shell-route";

export function SiteLayoutShell({
  pathname,
  navAuth,
  v2NavAuth,
  isLoggedIn,
  children,
}: {
  pathname: string;
  navAuth: React.ReactNode;
  v2NavAuth: React.ReactNode;
  isLoggedIn: boolean;
  children: React.ReactNode;
}) {
  if (isHomeV2Route(pathname) || isPricingRoute(pathname) || isAuthFullscreenRoute(pathname)) {
    return <>{children}</>;
  }

  if (isLegacyHome(pathname)) {
    return (
      <div data-site-home className="min-h-screen overflow-x-clip">
        <div className="site-home-page-bg min-h-screen overflow-x-clip">
          <SiteHomeNav isLoggedIn={isLoggedIn}>{navAuth}</SiteHomeNav>
          {children}
          <CookieConsentBanner />
        </div>
      </div>
    );
  }

  return (
    <SiteHomeV2Chrome
      isLoggedIn={isLoggedIn}
      authSlot={v2NavAuth}
      siteHomeBody={prefersSiteHomeBody(pathname)}
    >
      {children}
    </SiteHomeV2Chrome>
  );
}
