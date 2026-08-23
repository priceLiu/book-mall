import { EcomLandingHome } from "@/components/ecom-landing-home";
import { EcomPortalTopBar } from "@/components/layout/ecom-portal-top-bar";
import { getMainSiteOrigin } from "@/lib/site-origin";

/** 公开落地页（可被搜索引擎收录）；未登录访问 `/` 时展示。 */
export function EcomLanding() {
  const bookOrigin = getMainSiteOrigin();
  return (
    <main className="flex h-dvh flex-col overflow-y-auto bg-[#0c0c0e]">
      <EcomPortalTopBar authed={false} bookOrigin={bookOrigin} />
      <EcomLandingHome />
    </main>
  );
}
