import { CookieConsentBanner } from "@/components/layout/cookie-consent-banner";
import { SiteHomeV2Nav } from "@/components/site-home-v2/site-home-v2-nav";
import { SiteHomeV2Root } from "@/components/site-home-v2/site-home-v2-root";
import { cn } from "@/lib/utils";

type SiteHomeV2ChromeProps = {
  children: React.ReactNode;
  isLoggedIn: boolean;
  /** 由 Server Layout 传入 <NavbarAuth appearance="site-home-v2" />，勿在此组件内 import auth */
  authSlot: React.ReactNode;
  /** 默认完整营销顶栏；仅管理后台 `admin` 使用精简顶栏 */
  surface?: "marketing" | "admin";
  /** 内容区挂 data-site-home，复用课程/商品等既有 site-home 样式 */
  siteHomeBody?: boolean;
  shellClassName?: string;
  bodyClassName?: string;
};

/** Book 营销子页统一壳：V2 Apple 顶栏 + 白底内容区（不含 / 与 /home-v2） */
export function SiteHomeV2Chrome({
  children,
  isLoggedIn,
  authSlot,
  surface = "marketing",
  siteHomeBody = false,
  shellClassName,
  bodyClassName,
}: SiteHomeV2ChromeProps) {
  return (
    <SiteHomeV2Root>
      <div
        data-site-home-v2
        className={cn("home-v2-chrome-shell min-h-screen", shellClassName)}
      >
        <SiteHomeV2Nav isLoggedIn={isLoggedIn} authSlot={authSlot} surface={surface} />
        <div
          {...(siteHomeBody ? { "data-site-home": true } : {})}
          className={cn("home-v2-chrome-body min-h-screen overflow-x-clip", bodyClassName)}
        >
          {children}
        </div>
        <CookieConsentBanner />
      </div>
    </SiteHomeV2Root>
  );
}
