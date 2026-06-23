import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { getToolsSsoSetupDiagnostics } from "@/lib/sso-tools-env";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

import { AdminNav } from "@/components/admin/admin-nav";
import "../site-home.css";

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

  const toolsSsoDiag = getToolsSsoSetupDiagnostics();
  const financeWebOrigin = getFinanceWebPublicOrigin();

  return (
    <div data-site-home className="min-h-screen overflow-x-clip">
      <div className="site-app-shell site-home-page-bg min-h-screen">
        <header className="site-app-subheader sticky top-0 z-40">
          <div className="flex min-h-14 max-w-none items-center gap-2 px-4 py-2 sm:px-6">
            <Link
              href="/admin"
              className="shrink-0 text-sm font-semibold text-[#1f2328] hover:text-[#0969da]"
            >
              管理后台
            </Link>
            <div className="min-w-0 flex-1">
              <AdminNav
                user={{
                  id: session.user.id,
                  email: session.user.email ?? null,
                  name: session.user.name ?? null,
                  image: session.user.image ?? null,
                }}
                toolsSsoReady={toolsSsoDiag.ready}
                toolsSsoIssues={toolsSsoDiag.issues}
                financeWebOrigin={financeWebOrigin}
              />
            </div>
          </div>
        </header>
        <div className="site-app-main mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
