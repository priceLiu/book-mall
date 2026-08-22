/** 已与厂商账单对账的行底色：付少(收益)浅绿；付多(亏)浅红；其余不着色。 */
export function reconciliationVendorRowBg(
  vendorListYuan: number,
  vendorUnits: number,
  amountDiffYuan: number,
): string {
  const hasVendorBill = vendorListYuan > 0 || vendorUnits > 0;
  if (!hasVendorBill || amountDiffYuan === 0) return "";
  // amountDiff = 平台挂牌 - 厂商挂牌；正 → 付少；负 → 付多(亏)
  if (amountDiffYuan > 0) return "bg-[#f6ffed]";
  return "bg-[#fff1f0]";
}

/** 金额差字体：付少 → 纯绿；付多 → 纯红 */
export function reconciliationAmountDiffClass(amountDiffYuan: number): string {
  if (amountDiffYuan === 0) return "text-[#262626]";
  if (amountDiffYuan > 0) return "font-medium text-[#52c41a]";
  return "font-medium text-[#ff4d4f]";
}

/** 行级毛利字体：正毛利绿；负毛利红 */
export function reconciliationProfitClass(profitYuan: number): string {
  if (profitYuan === 0) return "text-[#262626]";
  if (profitYuan > 0) return "font-medium text-[#52c41a]";
  return "font-medium text-[#ff4d4f]";
}

export type VendorGroupedLines<T extends ReconciliationGroupLine> = {
  vendorDisplayName: string;
  lines: T[];
  totalVendorListYuan: number;
  totalPlatformListYuan: number;
  totalPlatformNetCostYuan: number;
  totalPlatformRevenueYuan: number;
  totalPlatformProfitYuan: number;
  totalAmountDiffYuan: number;
};

type ReconciliationGroupLine = {
  vendorDisplayName?: string;
  amountDiffYuan: number;
  vendorListYuan: number;
  platformListYuan: number;
  platformNetCostYuan?: number;
  platformRevenueYuan?: number;
  platformProfitYuan?: number;
};

/** 明细按厂商分组，组内按金额差绝对值降序。 */
export function groupReconciliationLinesByVendor<T extends ReconciliationGroupLine>(
  lines: T[],
): VendorGroupedLines<T>[] {
  const map = new Map<string, T[]>();
  for (const line of lines) {
    const key = line.vendorDisplayName?.trim() || "未登记";
    const bucket = map.get(key) ?? [];
    bucket.push(line);
    map.set(key, bucket);
  }

  return [...map.entries()]
    .map(([vendorDisplayName, groupLines]) => {
      const sorted = [...groupLines].sort(
        (a, b) => Math.abs(b.amountDiffYuan) - Math.abs(a.amountDiffYuan),
      );
      let totalVendorListYuan = 0;
      let totalPlatformListYuan = 0;
      let totalPlatformNetCostYuan = 0;
      let totalPlatformRevenueYuan = 0;
      let totalAmountDiffYuan = 0;
      for (const l of sorted) {
        totalVendorListYuan += l.vendorListYuan;
        totalPlatformListYuan += l.platformListYuan;
        totalPlatformNetCostYuan += l.platformNetCostYuan ?? 0;
        totalPlatformRevenueYuan += l.platformRevenueYuan ?? 0;
        totalAmountDiffYuan += l.amountDiffYuan;
      }
      const totalPlatformProfitYuan = totalPlatformRevenueYuan - totalPlatformNetCostYuan;
      return {
        vendorDisplayName,
        lines: sorted,
        totalVendorListYuan,
        totalPlatformListYuan,
        totalPlatformNetCostYuan,
        totalPlatformRevenueYuan,
        totalPlatformProfitYuan,
        totalAmountDiffYuan,
      };
    })
    .sort((a, b) => b.totalPlatformListYuan - a.totalPlatformListYuan);
}

/** 汇总卡片金额差颜色（与明细列一致） */
export function reconciliationSummaryDiffClass(diff: number): string {
  return reconciliationAmountDiffClass(diff);
}
