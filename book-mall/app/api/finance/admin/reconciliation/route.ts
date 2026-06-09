import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { prisma } from "@/lib/prisma";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** 对账页初始数据（历史批次、绑定、用户列表）。 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "云账单对账仅财务管理员可见");
  }

  const [recentRuns, bindings, users] = await Promise.all([
    prisma.billingReconciliationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        csvFilename: true,
        monthsCovered: true,
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

  return financeJson(request, {
    recentRuns: recentRuns.map((r) => ({
      id: r.id,
      csvFilename: r.csvFilename,
      monthsCovered: r.monthsCovered,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      summary: r.summary,
    })),
    bindings: bindings.map((b) => ({
      id: b.id,
      cloudAccountId: b.cloudAccountId,
      cloudAccountName: b.cloudAccountName,
      userId: b.userId,
      userName: b.user.name,
      userEmail: b.user.email,
    })),
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email })),
  });
}
