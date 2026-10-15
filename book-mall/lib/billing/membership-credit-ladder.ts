/**
 * 会员积分台阶（四档）：标准 ¥99、进阶 ¥299、高级 ¥699、至尊 ¥1199；
 * ppc 不低于 0.08 / 0.072 / 0.058 / 0.04。
 * 年付：价 = 月价 × 10；积分 = 月积分 × 12。
 * 团队每席价随个人同档同比；每席积分 = 每席价 ÷ 同档 ppc。
 */
export const MEMBERSHIP_MONTH_PPC = {
  标准版: 0.08,
  进阶版: 0.072,
  高级版: 0.058,
  至尊版: 0.04,
} as const;

export const PERSONAL_MONTH_PRICES = {
  标准版: 99,
  进阶版: 299,
  高级版: 699,
  至尊版: 1199,
} as const;

export const PERSONAL_MONTH_CREDITS = {
  标准版: 1230,
  进阶版: 4150,
  高级版: 12050,
  至尊版: 30000,
} as const;

/** 团队每席月价（相对个人同档同比上调后取整） */
export const TEAM_SEAT_MONTH_PRICES = {
  标准版: 289,
  进阶版: 769,
  高级版: 1199,
  至尊版: 1999,
} as const;

/** 团队每席月积分（每席价 ÷ 同档 ppc） */
export const TEAM_SEAT_MONTH_CREDITS = {
  标准版: 3610,
  进阶版: 10680,
  高级版: 20670,
  至尊版: 50000,
} as const;

export const RETIRED_MEMBERSHIP_TIERS = ["豪华版"] as const;

export function yearCreditsFromMonth(monthCredits: number): number {
  return monthCredits * 12;
}
