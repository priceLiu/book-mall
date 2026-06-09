import { NextRequest, NextResponse } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  financeForbidden,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { financeCorsHeaders } from "@/lib/finance/cors";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/**
 * v007 Round 5：列出"有账单明细的用户"——给 finance-web admin 用户列表页用。
 * - 仅 `ADMIN` 角色可访问；
 * - 返回 `{ users: [{ id, name, email, lineCount, latestAt }] }`，按 latestAt desc 排；
 * - 数据源：`ToolBillingDetailLine`（含 TOOL_USAGE_GENERATED + CLOUD_CSV_IMPORT 两类行）。
 */
export async function GET(request: NextRequest) {
  const cors = financeCorsHeaders(request);
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) return financeForbidden(request, "需要财务/超管权限");

  const grouped = await prisma.toolBillingDetailLine.groupBy({
    by: ["userId"],
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: 200,
  });

  if (grouped.length === 0) {
    return NextResponse.json({ users: [] }, { headers: cors });
  }

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const out = grouped
    .map((g) => {
      const u = userMap.get(g.userId);
      return {
        id: g.userId,
        name: u?.name ?? null,
        email: u?.email ?? null,
        lineCount: g._count._all,
        latestAt: g._max.createdAt?.toISOString() ?? null,
      };
    })
    .filter((u) => u.email || u.name);

  return NextResponse.json({ users: out }, { headers: cors });
}
