/**
 * 云账单 consumedetailbillv2 常见「费用类型」取值（与控制台选项对齐）。
 * 下拉中会与当前用户明细行中实际出现的值合并，避免仅预置列表遗漏数据。
 */
export const CLOUD_BILL_FEE_TYPE_PRESET: readonly string[] = [
  "云资源按量费用",
  "订阅预付费用",
  "订阅后付费用",
  "订阅退订费用",
  "保底封顶费用",
  "佣金费用",
  "调账费用",
  "抹零费用",
];

export function mergeFeeTypeOptions(fromRows: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of CLOUD_BILL_FEE_TYPE_PRESET) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  for (const t of fromRows) {
    const s = t?.trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}
