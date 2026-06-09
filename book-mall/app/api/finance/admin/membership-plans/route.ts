import { NextRequest } from "next/server";

import { canManagePricing } from "@/lib/auth/permissions";
import { bodyToFormData } from "@/lib/finance/body-to-form-data";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { prisma } from "@/lib/prisma";
import {
  deleteMembershipPlanAction,
  deleteSeatTierAction,
  upsertMembershipPlanAction,
  upsertSeatTierAction,
} from "@/app/admin/finance/credit-billing-actions";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "会员套餐仅财务管理员可维护");
  }

  const plans = await prisma.membershipPlan.findMany({
    orderBy: [{ family: "asc" }, { interval: "asc" }, { sortOrder: "asc" }],
    include: { seatTiers: { orderBy: { sortOrder: "asc" } } },
  });

  return financeJson(request, {
    plans: plans.map((p) => ({
      id: p.id,
      family: p.family,
      interval: p.interval,
      tier: p.tier,
      sortOrder: p.sortOrder,
      priceYuan: Number(p.priceYuan),
      originalYuan: p.originalYuan == null ? null : Number(p.originalYuan),
      promoLabel: p.promoLabel,
      monthlyCredits: p.monthlyCredits,
      videoMonthlyCredits: p.videoMonthlyCredits,
      includedSeats: p.includedSeats,
      active: p.active,
      seatTiers: p.seatTiers.map((t) => ({
        id: t.id,
        planId: t.planId,
        seatMin: t.seatMin,
        seatMax: t.seatMax,
        perSeatPriceYuan: Number(t.perSeatPriceYuan),
        perSeatCredits: t.perSeatCredits,
        sortOrder: t.sortOrder,
      })),
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) return financeForbidden(request);

  const body = (await request.json()) as { action: string } & Record<string, unknown>;
  const fd = bodyToFormData(body);
  let result;
  switch (body.action) {
    case "upsertPlan":
      result = await upsertMembershipPlanAction(fd);
      break;
    case "deletePlan":
      result = await deleteMembershipPlanAction(fd);
      break;
    case "upsertSeatTier":
      result = await upsertSeatTierAction(fd);
      break;
    case "deleteSeatTier":
      result = await deleteSeatTierAction(fd);
      break;
    default:
      return financeJson(request, { ok: false, error: `未知操作: ${body.action}` }, { status: 400 });
  }
  return financeJson(request, result, { status: result.ok ? 200 : 400 });
}
