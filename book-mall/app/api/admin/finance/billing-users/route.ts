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
 * 列出「有账单/用量记录的用户」——finance-web admin 用户列表页。
 * Union：ToolBillingDetailLine + GatewayRequestLog（Finance 2.0）。
 */
export async function GET(request: NextRequest) {
  const cors = financeCorsHeaders(request);
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) return financeForbidden(request, "需要财务/超管权限");

  const [legacyGrouped, gatewayGrouped, gatewaySucceededGrouped] = await Promise.all([
    prisma.toolBillingDetailLine.groupBy({
      by: ["userId"],
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.gatewayRequestLog.groupBy({
      by: ["actorBookUserId"],
      where: { actorBookUserId: { not: null } },
      _count: { _all: true },
      _max: { submittedAt: true },
    }),
    prisma.gatewayRequestLog.groupBy({
      by: ["actorBookUserId"],
      where: { actorBookUserId: { not: null }, status: "SUCCEEDED" },
      _count: { _all: true },
    }),
  ]);

  const succeededByUser = new Map(
    gatewaySucceededGrouped.map((g) => [g.actorBookUserId!, g._count._all]),
  );

  const merged = new Map<
    string,
    { lineCount: number; succeededCalls: number; latestAt: Date | null }
  >();

  for (const g of legacyGrouped) {
    merged.set(g.userId, {
      lineCount: g._count._all,
      succeededCalls: g._count._all,
      latestAt: g._max.createdAt,
    });
  }

  for (const g of gatewayGrouped) {
    const uid = g.actorBookUserId!;
    const ex = merged.get(uid);
    const gwLatest = g._max.submittedAt;
    const succeededCalls = succeededByUser.get(uid) ?? 0;
    if (!ex) {
      merged.set(uid, {
        lineCount: g._count._all,
        succeededCalls,
        latestAt: gwLatest,
      });
    } else {
      merged.set(uid, {
        lineCount: ex.lineCount + g._count._all,
        succeededCalls: ex.succeededCalls + succeededCalls,
        latestAt:
          ex.latestAt && gwLatest
            ? ex.latestAt > gwLatest
              ? ex.latestAt
              : gwLatest
            : (ex.latestAt ?? gwLatest),
      });
    }
  }

  if (merged.size === 0) {
    return NextResponse.json({ users: [] }, { headers: cors });
  }

  const sorted = Array.from(merged.entries())
    .sort((a, b) => {
      const ta = a[1].latestAt?.getTime() ?? 0;
      const tb = b[1].latestAt?.getTime() ?? 0;
      return tb - ta;
    })
    .slice(0, 200);

  const users = await prisma.user.findMany({
    where: { id: { in: sorted.map(([id]) => id) } },
    select: { id: true, name: true, email: true, phone: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const out = sorted
    .map(([id, stats]) => {
      const u = userMap.get(id);
      return {
        id,
        name: u?.name ?? null,
        email: u?.email ?? null,
        phone: u?.phone ?? null,
        lineCount: stats.lineCount,
        succeededCalls: stats.succeededCalls,
        latestAt: stats.latestAt?.toISOString() ?? null,
      };
    })
    .filter((u) => u.email || u.name || u.phone);

  return NextResponse.json({ users: out }, { headers: cors });
}
