/**
 * 团队 Gateway / 视频并发默认值。
 * 目标：少配 env，代码默认保底 20 人同时生视频，人数再多随席位数扩展。
 */

import { getTeamMaxConcurrencyCap } from "@/lib/generation/poll-config";

/** 套餐档参考值（计费/展示；不再硬性压低团队并发） */
export const TEAM_TIER_MAX_CONCURRENCY: Record<string, number> = {
  标准版: 2,
  进阶版: 5,
  高级版: 10,
  豪华版: 20,
  至尊版: 35,
};

/** 席位数 ≥ 此值时，团队 Gateway 并发至少为此数（无需 env） */
export const TEAM_CONCURRENCY_STUDIO_FLOOR = 20;

/** 团队并发软顶（防误配） */
export const TEAM_MAX_CONCURRENCY_SOFT_CAP = 200;

export function teamTierMaxConcurrency(packageLevel?: string | null): number {
  if (!packageLevel) return 2;
  return TEAM_TIER_MAX_CONCURRENCY[packageLevel] ?? 2;
}

/** 仅当显式设置 TEAM_MAX_CONCURRENCY_CAP 时生效（高级调优，日常不必配） */
export function resolveTeamConcurrencyCap(packageLevel?: string | null): number {
  const tierCap = teamTierMaxConcurrency(packageLevel);
  const globalCap = getTeamMaxConcurrencyCap();
  if (globalCap == null) return tierCap;
  return Math.max(tierCap, globalCap);
}

/**
 * 新建/扩容团队时的默认 Gateway 并发。
 * - 默认 = 席位数（软顶 200）
 * - 席 ≥ 20 → 至少 20 路
 * - 20+ 人继续增加席位则并发同步增加，无需改 env
 */
export function resolveDefaultTeamMaxConcurrency(input: {
  seatLimit: number;
  packageLevel?: string | null;
  explicit?: number | null;
}): number {
  if (input.explicit != null && input.explicit > 0) {
    return Math.round(input.explicit);
  }
  const seats = Math.max(1, Math.round(input.seatLimit));
  const tierCap = teamTierMaxConcurrency(input.packageLevel);
  const envCap = getTeamMaxConcurrencyCap();

  let n = seats;
  if (seats >= TEAM_CONCURRENCY_STUDIO_FLOOR) {
    n = Math.max(n, TEAM_CONCURRENCY_STUDIO_FLOOR);
  }
  n = Math.max(n, tierCap);
  if (envCap != null) {
    n = Math.min(Math.max(n, envCap), seats);
  }

  return Math.min(n, seats, TEAM_MAX_CONCURRENCY_SOFT_CAP);
}
