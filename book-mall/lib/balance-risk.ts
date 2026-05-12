import type { PlatformConfig } from "@prisma/client";

export type BalanceRiskLevel = "critical" | "warn_mid" | "warn_high" | "ok";

/** 余额相对平台水位线的分级（用于后台预警样式）。 */
export function balanceRiskLevel(
  balanceMinor: number | null | undefined,
  cfg: Pick<
    PlatformConfig,
    "minBalanceLineMinor" | "balanceWarnMidMinor" | "balanceWarnHighMinor"
  >,
): BalanceRiskLevel {
  const b = typeof balanceMinor === "number" ? balanceMinor : 0;
  if (b < cfg.minBalanceLineMinor) return "critical";
  if (b < cfg.balanceWarnMidMinor) return "warn_mid";
  if (b < cfg.balanceWarnHighMinor) return "warn_high";
  return "ok";
}

/** 筛选下拉对应的阈值（分）；低于该值且含「无钱包」用户。 */
export function balanceRiskThresholdMinor(
  risk: string,
  cfg: Pick<
    PlatformConfig,
    "minBalanceLineMinor" | "balanceWarnMidMinor" | "balanceWarnHighMinor"
  >,
): number | null {
  switch (risk) {
    case "below_min":
      return cfg.minBalanceLineMinor;
    case "below_mid":
      return cfg.balanceWarnMidMinor;
    case "below_high":
      return cfg.balanceWarnHighMinor;
    default:
      return null;
  }
}
