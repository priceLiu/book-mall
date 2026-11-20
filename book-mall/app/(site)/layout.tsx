import { getServerSession } from "next-auth";
import { HomeV2NavAuthSlot } from "@/components/layout/home-v2-nav-auth-slot";
import { NavbarAuth } from "@/components/layout/navbar-auth";
import { SiteLayoutShellGate } from "@/components/layout/site-home/site-layout-shell-gate";
import { authOptions } from "@/lib/auth";
import "../site-home.css";
import "../site-home-v2.css";

/** 构建阶段 CI 往往无 DATABASE_URL；避免对 Prisma 做静态预渲染 */
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <SiteLayoutShellGate
      navAuth={<NavbarAuth appearance="site-home" />}
      v2NavAuth={<HomeV2NavAuthSlot />}
      isLoggedIn={Boolean(session?.user)}
    >
      {children}
    </SiteLayoutShellGate>
  );
}
