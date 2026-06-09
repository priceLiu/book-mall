/**
 * 与 `book-mall/lib/finance/bill-display-keys.ts` 严格镜像（v009 / Finance 2.0）。
 */
export const RETAIL_MULTIPLIER_DEFAULT = 2;

export type ColumnGroup = { group: string; keys: string[] };

export const K_CREDITS_CONSUMED = "平台/消耗积分";

export const BILL_COLUMN_GROUPS: ColumnGroup[] = [
  {
    group: "基本信息",
    keys: [
      "平台/用户ID",
      "平台/用户名",
      "平台/工具页面",
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
  "平台/Gateway日志ID",
  "平台/行来源",
]);

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
