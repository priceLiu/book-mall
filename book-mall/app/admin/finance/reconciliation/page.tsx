import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReconciliationClient } from "./reconciliation-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "云账单对账 — 管理后台",
};

export default async function ReconciliationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const [recentRuns, bindings, users] = await Promise.all([
    prisma.billingReconciliationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        csvFilename: true,
        monthsCovered: true,
        importedByUserId: true,
        status: true,
        summary: true,
        createdAt: true,
      },
    }),
    prisma.cloudAccountBinding.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true },
      take: 200,
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-xl font-medium">云账单对账</h1>
        <p className="text-sm text-muted-foreground">
          上传阿里云 `consumedetailbillv2` CSV，系统会自动按「资源购买账号 ID」映射到平台用户，
          导入云行后跑对账并入库（`BillingReconciliationRun`）。亏损用户行可在报告里二次确认后一键补扣。
        </p>
      </header>

      <ReconciliationClient
        recentRuns={recentRuns.map((r) => ({
          id: r.id,
          csvFilename: r.csvFilename,
          monthsCovered: r.monthsCovered,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          summary: r.summary as unknown,
        }))}
        bindings={bindings.map((b) => ({
          id: b.id,
          cloudAccountId: b.cloudAccountId,
          cloudAccountName: b.cloudAccountName,
          userId: b.userId,
          userName: b.user.name,
          userEmail: b.user.email,
        }))}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
      />
    </div>
  );
}
