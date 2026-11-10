import { CookieConsentBanner } from "@/components/layout/cookie-consent-banner";
import { SiteHomeV2Root } from "@/components/site-home-v2/site-home-v2-root";
import "../site-home-v2.css";

export const dynamic = "force-dynamic";

export default function HomeV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <SiteHomeV2Root>
      {children}
      <CookieConsentBanner />
    </SiteHomeV2Root>
  );
}
