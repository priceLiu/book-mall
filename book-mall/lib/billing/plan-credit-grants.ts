/**
 * 套餐开通/续费时的双池积分发放额（通用池 + 视频池）。
 *
 * PERSONAL：monthlyCredits / videoMonthlyCredits 为账户总额。
 * TEAM：二者均为每席额度，发放时 × totalSeats。
 */
import type { MembershipPlan } from "@prisma/client";

export interface PlanCreditGrantAmounts {
  generalCredits: number;
  videoCredits: number;
  monthlyGrantCredits: number;
  videoMonthlyGrantCredits: number;
}

export function resolvePlanCreditGrants(
  plan: Pick<MembershipPlan, "family" | "monthlyCredits" | "videoMonthlyCredits">,
  totalSeats = 1,
): PlanCreditGrantAmounts {
  const seats = Math.max(1, Math.round(totalSeats));
  const perSeatMonthly = plan.monthlyCredits;
  const perSeatVideo = plan.videoMonthlyCredits ?? 0;
  const perSeatGeneral = Math.max(0, perSeatMonthly - perSeatVideo);

  const multiplier = plan.family === "TEAM" ? seats : 1;
  const generalCredits = perSeatGeneral * multiplier;
  const videoCredits = perSeatVideo * multiplier;

  return {
    generalCredits,
    videoCredits,
    monthlyGrantCredits: generalCredits,
    videoMonthlyGrantCredits: videoCredits,
  };
}
