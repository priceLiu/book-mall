import type { ReferralDashboard } from "@/lib/referral/referral-service";

export type ReferralDashboardJson = Omit<ReferralDashboard, "rows"> & {
  planLabel: string | null;
  rows: {
    userId: string;
    name: string | null;
    phoneMasked: string;
    joinedAt: string;
    planAmountYuan: number;
    rechargeAmountYuan: number;
  }[];
};

export function serializeReferralDashboard(
  dashboard: ReferralDashboard,
  planLabel: string | null,
): ReferralDashboardJson {
  return {
    ...dashboard,
    planLabel,
    rows: dashboard.rows.map((row) => ({
      ...row,
      joinedAt: row.joinedAt.toISOString(),
    })),
  };
}
