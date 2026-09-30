/**
 * 会员积分台阶（四档）：进阶 ¥269、高级 ¥699，ppc 不低于 0.08 / 0.072 / 0.058 / 0.04。
 * 年付：价 = 月价 × 10；积分 = 月积分 × 12。
 */
export const MEMBERSHIP_MONTH_PPC = {
  标准版: 0.08,
  进阶版: 0.072,
  高级版: 0.058,
  至尊版: 0.04,
} as const;

export const PERSONAL_MONTH_PRICES = {
  标准版: 69,
  进阶版: 269,
  高级版: 699,
  至尊版: 1199,
} as const;

export const PERSONAL_MONTH_CREDITS = {
  标准版: 860,
  进阶版: 3730,
  高级版: 12050,
  至尊版: 30000,
} as const;

/** 团队每席月积分（每席价 ÷ 同档 ppc；席位价不跟个人同倍率涨） */
export const TEAM_SEAT_MONTH_CREDITS = {
  标准版: 2490,
  进阶版: 9570,
  高级版: 20670,
  至尊版: 50000,
} as const;

export const RETIRED_MEMBERSHIP_TIERS = ["豪华版"] as const;

export function yearCreditsFromMonth(monthCredits: number): number {
  return monthCredits * 12;
}
