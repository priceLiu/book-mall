import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NavbarAuth } from "@/components/layout/navbar-auth";
import { authOptions } from "@/lib/auth";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

import { AdminAppShell } from "@/components/admin/admin-app-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import "../site-home.css";
import "../site-home-v2.css";

/** 构建阶段 CI 往往无 DATABASE_URL；避免对 Prisma 做静态预渲染 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "管理后台",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!canViewFinanceCost(session.user.role)) redirect("/account");

  const financeWebOrigin = getFinanceWebPublicOrigin();

  return (
    <AdminAppShell navAuth={<NavbarAuth appearance="site-home-v2" />}>
      <header className="admin-subnav-bar sticky top-[var(--header-h)] z-30 border-b border-[#d1d9e0] bg-white/95 backdrop-blur-md">
        <div className="flex min-h-11 max-w-none items-center gap-2 px-4 py-1.5 sm:px-6 lg:px-8">
          <div className="min-w-0 flex-1">
            <AdminNav
              user={{
                id: session.user.id,
                email: session.user.email ?? null,
                name: session.user.name ?? null,
                image: session.user.image ?? null,
              }}
              financeWebOrigin={financeWebOrigin}
            />
          </div>
        </div>
      </header>
      <div className="site-app-main mx-auto w-full max-w-none px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </AdminAppShell>
  );
}
