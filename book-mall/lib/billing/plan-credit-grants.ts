/**
 * 套餐开通/续费时的积分发放额（单池 v2）。
 *
 * PERSONAL：monthlyCredits 为账户总额。
 * TEAM：monthlyCredits 为每席额度，发放时 × totalSeats。
 */
import type { MembershipPlan } from "@prisma/client";

export interface PlanCreditGrantAmounts {
  credits: number;
  monthlyGrantCredits: number;
}

export function resolvePlanCreditGrants(
  plan: Pick<MembershipPlan, "family" | "monthlyCredits">,
  totalSeats = 1,
): PlanCreditGrantAmounts {
  const seats = Math.max(1, Math.round(totalSeats));
  const perSeatMonthly = plan.monthlyCredits;
  const multiplier = plan.family === "TEAM" ? seats : 1;
  const totalCredits = perSeatMonthly * multiplier;

  return {
    credits: totalCredits,
    monthlyGrantCredits: totalCredits,
  };
}
