/**
 * 费用明细列定义（v009 / Finance 2.0 积分账单）。
 *
 * 已移除 legacy：系数(M)、定价、扣点、计费公式、应付金额、厂商 CSV 各组。
 * 扣费统一为「平台/消耗积分」；管理员另见「财务核算」净成本/毛利率。
 *
 * 与 `finance-web/lib/bill-config.ts` 严格保持镜像同步。
 */

export type ColumnGroup = { group: string; keys: string[] };

/** 积分消耗列（汇总/筛选统一引用）。 */
export const K_CREDITS_CONSUMED = "平台/消耗积分";
export const K_MODEL_VENDOR = "平台/厂商";
export const K_SETTLEMENT_KIND = "套餐对帐/结算类型";
export const K_TASK_KIND = "套餐对帐/任务类型";
export const K_QUOTA_DELTA = "套餐对帐/扣次";
export const K_INCLUDED_USED = "套餐对帐/已用";
export const K_INCLUDED_REMAINING = "套餐对帐/剩余";
export const K_GATEWAY_KEY = "平台/Gateway Key";
export const K_USER_KEY = "平台/User Key";

export const BILL_COLUMN_GROUPS: ColumnGroup[] = [
  {
    group: "基本信息",
    keys: [
      "平台/用户ID",
      "平台/用户名",
      "平台/工具页面",
      K_MODEL_VENDOR,
      K_GATEWAY_KEY,
      K_USER_KEY,
      "平台/模型Code",
      "平台/模型名称",
      "平台/请求类型",
      K_CREDITS_CONSUMED,
      "平台/计费身份",
      "平台/状态",
      "平台/Gateway日志ID",
      "平台/行来源",
    ],
  },
  {
    group: "账单时间",
    keys: ["平台账单/账单月份", "平台账单/消费时间", "平台账单/费用说明"],
  },
  {
    group: "套餐对帐",
    keys: [
      K_SETTLEMENT_KIND,
      K_TASK_KIND,
      K_QUOTA_DELTA,
      K_INCLUDED_USED,
      K_INCLUDED_REMAINING,
    ],
  },
  {
    group: "用量",
    keys: ["平台用量/用量", "平台用量/用量单位"],
  },
  {
    group: "财务核算",
    keys: ["财务核算/净成本(元)", "财务核算/毛利率"],
  },
];

export const ALL_DISPLAY_KEYS = BILL_COLUMN_GROUPS.flatMap((g) => g.keys);

export const ADMIN_ONLY_KEYS: ReadonlySet<string> = new Set([
  "平台/用户ID",
  K_MODEL_VENDOR,
  "平台/Gateway日志ID",
  "平台/行来源",
]);

/** 财务核算组仅管理员可见。 */
export const ADMIN_ONLY_GROUPS: ReadonlySet<string> = new Set(["财务核算"]);

export type BillViewerRole = "user" | "admin";

export function filterColumnGroupsByRole(
  groups: readonly ColumnGroup[],
  role: BillViewerRole,
): ColumnGroup[] {
  if (role === "admin") return [...groups];
  return groups
    .filter((g) => !ADMIN_ONLY_GROUPS.has(g.group))
    .map((g) => ({
      group: g.group,
      keys: g.keys.filter((k) => !ADMIN_ONLY_KEYS.has(k)),
    }))
    .filter((g) => g.keys.length > 0);
}
