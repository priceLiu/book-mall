import type { PlatformConfig } from "@prisma/client";

export type BalanceRiskLevel = "critical" | "warn_mid" | "warn_high" | "ok";

/** 余额相对平台水位线的分级（用于后台预警样式）。 */
export function balanceRiskLevel(
  balancePoints: number | null | undefined,
  cfg: Pick<
    PlatformConfig,
    "minBalanceLinePoints" | "balanceWarnMidPoints" | "balanceWarnHighPoints"
  >,
): BalanceRiskLevel {
  const b = typeof balancePoints === "number" ? balancePoints : 0;
  if (b < cfg.minBalanceLinePoints) return "critical";
  if (b < cfg.balanceWarnMidPoints) return "warn_mid";
  if (b < cfg.balanceWarnHighPoints) return "warn_high";
  return "ok";
}

/** 筛选下拉对应的阈值（分）；低于该值且含「无钱包」用户。 */
export function balanceRiskThresholdPoints(
  risk: string,
  cfg: Pick<
    PlatformConfig,
    "minBalanceLinePoints" | "balanceWarnMidPoints" | "balanceWarnHighPoints"
  >,
): number | null {
  switch (risk) {
    case "below_min":
      return cfg.minBalanceLinePoints;
    case "below_mid":
      return cfg.balanceWarnMidPoints;
    case "below_high":
      return cfg.balanceWarnHighPoints;
    default:
      return null;
  }
}
