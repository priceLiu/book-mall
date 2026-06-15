import { NextRequest } from "next/server";

import { buildTeamCreditBill } from "@/lib/billing/credit-reconciliation";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { currentPeriodKey } from "@/lib/finance/team-finance-guard";
import { prisma } from "@/lib/prisma";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** 平台员工 · 全量团队列表（财务驾驶舱）。 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "需要财务/超管权限");
  }

  const periodKey =
    request.nextUrl.searchParams.get("periodKey")?.trim() || currentPeriodKey();
  const take = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("take") ?? 100)));
  const skip = Math.max(0, Number(request.nextUrl.searchParams.get("skip") ?? 0));

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where: { type: "TEAM", status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        name: true,
        packageLevel: true,
        seatLimit: true,
        ownerUserId: true,
        createdAt: true,
      },
    }),
    prisma.tenant.count({ where: { type: "TEAM", status: "ACTIVE" } }),
  ]);

  const ownerIds = [...new Set(tenants.map((t) => t.ownerUserId))];
  const owners =
    ownerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true, email: true, phone: true },
        })
      : [];
  const ownerMap = new Map(owners.map((o) => [o.id, o]));

  const tenantIds = tenants.map((t) => t.id);
  const accounts =
    tenantIds.length > 0
      ? await prisma.creditAccount.findMany({
          where: { ownerType: "TENANT", ownerId: { in: tenantIds } },
          select: { ownerId: true, balanceCredits: true },
        })
      : [];
  const balanceMap = new Map(accounts.map((a) => [a.ownerId, a.balanceCredits]));

  const teams = await Promise.all(
    tenants.map(async (t) => {
      const bill = await buildTeamCreditBill({ tenantId: t.id, periodKey });
      const owner = ownerMap.get(t.ownerUserId);
      const activeMembers = await prisma.tenantMember.count({
        where: { tenantId: t.id, status: "ACTIVE" },
      });
      return {
        tenantId: t.id,
        name: t.name,
        packageLevel: t.packageLevel,
        seatLimit: t.seatLimit,
        activeMembers,
        balanceCredits: balanceMap.get(t.id) ?? 0,
        monthConsumed: bill.consumed,
        owner: {
          id: t.ownerUserId,
          name: owner?.name ?? null,
          email: owner?.email ?? null,
          phone: owner?.phone ?? null,
        },
        createdAt: t.createdAt.toISOString(),
      };
    }),
  );

  return financeJson(request, { periodKey, teams, total, take, skip });
}
