/**
 * 套餐开通/续费时的积分发放额（单池 v2）。
 *
 * PERSONAL：monthlyCredits 为账户总额。
 * TEAM：monthlyCredits 为每席额度，发放时 × totalSeats。
 * YEAR：monthlyCredits 为全年总额；按 31 天积分周期发放，每期 = 全年 ÷ 12。
 */
import type { MembershipPlan } from "@prisma/client";

import { round2 } from "@/lib/pricing/credit-pricing-formulas";

export const YEAR_PLAN_CREDIT_PERIODS = 12;

export interface PlanCreditGrantAmounts {
  credits: number;
  monthlyGrantCredits: number;
}

export function resolvePlanCreditGrants(
  plan: Pick<MembershipPlan, "family" | "monthlyCredits" | "interval">,
  totalSeats = 1,
  /** 团队席位带命中的每席积分（与 quoteTeamPlan 一致）；缺省用 plan.monthlyCredits */
  perSeatCreditsOverride?: number | null,
): PlanCreditGrantAmounts {
  const seats = Math.max(1, Math.round(totalSeats));
  const perSeat =
    perSeatCreditsOverride != null && perSeatCreditsOverride > 0
      ? perSeatCreditsOverride
      : Number(plan.monthlyCredits);
  const multiplier = plan.family === "TEAM" ? seats : 1;
  const perInterval = perSeat * multiplier;
  const perPeriod =
    plan.interval === "YEAR" ? round2(perInterval / YEAR_PLAN_CREDIT_PERIODS) : perInterval;

  return {
    credits: perPeriod,
    monthlyGrantCredits: perPeriod,
  };
}

/**
 * 同档续费且会员服务与积分周期均未到期：只顺延服务期，不立即发放；
 * 下一期由 runMonthlyResetSweep 在 currentPeriodEnd 按 monthlyGrantCredits 发放。
 * 首购、已过期后续费、换档仍立即发放。
 */
export function shouldDeferRenewalGrant(input: {
  accountPlanId: string | null | undefined;
  planId: string;
  paidUntilBefore: Date | null | undefined;
  creditPeriodEnd: Date | null | undefined;
  now: Date;
}): boolean {
  if (!input.accountPlanId || input.accountPlanId !== input.planId) return false;
  if (!input.paidUntilBefore || input.paidUntilBefore <= input.now) return false;
  if (!input.creditPeriodEnd || input.creditPeriodEnd <= input.now) return false;
  return true;
}
