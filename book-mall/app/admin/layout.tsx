import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { getToolsSsoSetupDiagnostics } from "@/lib/sso-tools-env";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

import { AdminNav } from "@/components/admin/admin-nav";

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
  // 后台外壳准入：ADMIN（历史）+ FINANCE + SUPER_ADMIN。各页再按 canViewFinanceCost /
  // canManagePricing / canCreateProposal 做更细门禁。OPERATIONS 暂不进外壳（多数非财务页
  // 仅靠本布局兜底，未逐页加权限，避免越权暴露），其提案能力待逐页鉴权后开放。
  if (!canViewFinanceCost(session.user.role)) redirect("/account");

  const toolsSsoDiag = getToolsSsoSetupDiagnostics();
  const financeWebOrigin = getFinanceWebPublicOrigin();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card text-card-foreground shadow-sm">
        <div className="container flex min-h-14 max-w-screen-xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 mx-auto">
          <Link href="/admin" className="font-semibold text-card-foreground shrink-0 hover:text-primary">
            管理后台
          </Link>
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
      </header>
      <div className="container max-w-screen-xl px-4 py-8 mx-auto">{children}</div>
    </div>
  );
}
