/**
 * 团队 Gateway / 视频并发默认值（席位 × 套餐档上限）。
 * 个人租户仍用 schema 默认 2；团队开通时按席位数与档位写入 Tenant.maxConcurrency。
 */

import { getTeamMaxConcurrencyCap } from "@/lib/generation/poll-config";

/** 套餐档并发上限（与 doc/plans gateway-multi-credential 轨道 D 一致） */
export const TEAM_TIER_MAX_CONCURRENCY: Record<string, number> = {
  标准版: 2,
  进阶版: 5,
  高级版: 10,
  豪华版: 20,
  至尊版: 35,
};

export function teamTierMaxConcurrency(packageLevel?: string | null): number {
  if (!packageLevel) return 2;
  return TEAM_TIER_MAX_CONCURRENCY[packageLevel] ?? 2;
}

/** 有效档位/全局并发上限（TEAM_MAX_CONCURRENCY_CAP 可提到 100+） */
export function resolveTeamConcurrencyCap(packageLevel?: string | null): number {
  const tierCap = teamTierMaxConcurrency(packageLevel);
  const globalCap = getTeamMaxConcurrencyCap();
  if (globalCap == null) return tierCap;
  return Math.max(tierCap, globalCap);
}

/**
 * 新建/扩容团队时的默认 Gateway 并发。
 * min(席位数, 有效上限)；100 席 + TEAM_MAX_CONCURRENCY_CAP=150 → 100。
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
  const cap = resolveTeamConcurrencyCap(input.packageLevel);
  return Math.min(seats, cap);
}
