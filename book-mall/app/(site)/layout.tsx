import { getServerSession } from "next-auth";
import { CookieConsentBanner } from "@/components/layout/cookie-consent-banner";
import { NavbarAuth } from "@/components/layout/navbar-auth";
import { SiteLayoutShell } from "@/components/layout/site-home/site-layout-shell";
import { authOptions } from "@/lib/auth";
import "../site-home.css";

/** 构建阶段 CI 往往无 DATABASE_URL；避免对 Prisma 做静态预渲染 */
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <SiteLayoutShell navAuth={<NavbarAuth appearance="site-home" />} isLoggedIn={Boolean(session?.user)}>
      {children}
      <CookieConsentBanner />
    </SiteLayoutShell>
  );
}
