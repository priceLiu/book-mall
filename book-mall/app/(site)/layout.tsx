import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { NavbarAuth } from "@/components/layout/navbar-auth";
import { SiteLayoutShell } from "@/components/layout/site-home/site-layout-shell";
import { authOptions } from "@/lib/auth";
import "../site-home.css";
import "../site-home-v2.css";

/** 构建阶段 CI 往往无 DATABASE_URL；避免对 Prisma 做静态预渲染 */
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const pathname =
    headers().get("x-book-pathname") ??
    headers().get("next-url")?.replace(/^https?:\/\/[^/]+/, "") ??
    "/";

  return (
    <SiteLayoutShell
      pathname={pathname.split("?")[0] || "/"}
      navAuth={<NavbarAuth appearance="site-home" />}
      v2NavAuth={<NavbarAuth appearance="site-home-v2" />}
      isLoggedIn={Boolean(session?.user)}
    >
      {children}
    </SiteLayoutShell>
  );
}
