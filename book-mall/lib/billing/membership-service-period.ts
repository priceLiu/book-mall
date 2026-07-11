/**
 * 会员付费服务有效期（准入 / 续费），与积分批次 31 天刷新周期解耦。
 *
 * - 月付：自支付成功起 31 天（点到点）
 * - 年付：自支付成功起 365 天（点到点）
 * - 续费：自 max(当前到期, now) 顺延对应天数
 */
import type { MembershipInterval } from "@prisma/client";

import { addDays } from "@/lib/billing/credit-lot-logic";

/** 会员付费服务有效天数（固定天数，非自然月/年）。 */
export const MEMBERSHIP_SERVICE_DAYS: Record<MembershipInterval, number> = {
  MONTH: 31,
  YEAR: 365,
};

/** 自 anchor 起算本次购买的会员服务截止时刻。 */
export function membershipPaidUntilFromPurchase(
  interval: MembershipInterval,
  anchor: Date = new Date(),
): Date {
  return addDays(anchor, MEMBERSHIP_SERVICE_DAYS[interval]);
}

/** 续费顺延：未过期从当前截止日续，已过期从 now 重算。 */
export function extendMembershipPaidUntil(
  current: Date | null | undefined,
  interval: MembershipInterval,
  now: Date = new Date(),
): Date {
  const base = current && current > now ? current : now;
  return addDays(base, MEMBERSHIP_SERVICE_DAYS[interval]);
}

/** 由服务截止日反推本付费周期起始时刻（用于展示）。 */
export function membershipServicePeriodStart(
  paidUntil: Date,
  interval: MembershipInterval,
): Date {
  return addDays(paidUntil, -MEMBERSHIP_SERVICE_DAYS[interval]);
}

/**
 * 会员服务是否在有效期内。
 * paidUntil 为空时视为有效（存量账户过渡，待下次续费写入截止日）。
 */
export function isMembershipServiceActive(
  paidUntil: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!paidUntil) return true;
  return paidUntil > now;
}
