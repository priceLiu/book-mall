import { NextRequest } from "next/server";

import { buildTeamCreditBill } from "@/lib/billing/credit-reconciliation";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  batchAggregateTeamGatewayTokenUsage,
  EMPTY_GATEWAY_TOKEN_USAGE,
  gatewayTokenUsageToRecord,
} from "@/lib/gateway/gateway-token-usage-aggregate";
import { currentPeriodKey, periodBounds } from "@/lib/finance/team-finance-guard";
import { resolveTenantPackageSnapshot } from "@/lib/finance/tenant-package-snapshot";
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
        planId: true,
        interval: true,
        currentPeriodEnd: true,
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

  const { from, to } = periodBounds(periodKey);
  const tokenByTenant = await batchAggregateTeamGatewayTokenUsage({
    tenantIds: tenants.map((t) => t.id),
    submittedFrom: from,
    submittedTo: to,
  });

  const teams = await Promise.all(
    tenants.map(async (t) => {
      const bill = await buildTeamCreditBill({ tenantId: t.id, periodKey });
      const pkg = await resolveTenantPackageSnapshot(t);
      const owner = ownerMap.get(t.ownerUserId);
      const activeMembers = await prisma.tenantMember.count({
        where: { tenantId: t.id, status: "ACTIVE" },
      });
      const tokenUsage = gatewayTokenUsageToRecord(
        tokenByTenant.get(t.id) ?? EMPTY_GATEWAY_TOKEN_USAGE,
      );
      return {
        tenantId: t.id,
        name: t.name,
        packageLevel: t.packageLevel,
        seatLimit: t.seatLimit,
        activeMembers,
        balanceCredits: pkg.remainingCredits,
        monthConsumed: bill.consumed,
        packageTotalCredits: pkg.packageTotalCredits,
        packageTotalPriceYuan: pkg.packageTotalPriceYuan,
        packageInterval: pkg.packageInterval,
        packageIntervalLabel: pkg.packageIntervalLabel,
        periodStartAt: pkg.periodStartAt,
        periodEndAt: pkg.periodEndAt,
        renewalCount: pkg.renewalCount,
        owner: {
          id: t.ownerUserId,
          name: owner?.name ?? null,
          email: owner?.email ?? null,
          phone: owner?.phone ?? null,
        },
        tokenUsage,
        createdAt: t.createdAt.toISOString(),
      };
    }),
  );

  return financeJson(request, { periodKey, teams, total, take, skip });
}
