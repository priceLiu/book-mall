/**
 * 与 `book-mall/lib/finance/bill-display-keys.ts` 严格镜像（v007 / 2026-05-17 Round 5）。
 * 任何改动必须双边同步——否则前端表头与后端 row 对不上。
 */
export const RETAIL_MULTIPLIER_DEFAULT = 2;

export type ColumnGroup = { group: string; keys: string[] };

export const BILL_COLUMN_GROUPS: ColumnGroup[] = [
  {
    group: "平台信息",
    keys: [
      "平台/用户ID",
      "平台/用户名",
      "平台/产品Code",
      "平台/产品名称",
      "平台/计费项Code",
      "平台/系数(M)",
      "平台/定价",
      "平台/扣点",
      "平台/计费公式",
      "平台/应付金额",
    ],
  },
  {
    group: "平台账单",
    keys: [
      "平台账单/账单月份",
      "平台账单/账单日期",
      "平台账单/费用类型",
      "平台账单/消费时间",
      "平台账单/服务开始时间",
      "平台账单/服务结束时间",
    ],
  },
  {
    group: "平台用量",
    keys: ["平台用量/抵扣前用量", "平台用量/用量", "平台用量/用量单位"],
  },
  {
    group: "厂商产品",
    keys: [
      "厂商产品/产品名称",
      "厂商产品/商品Code",
      "厂商产品/商品名称",
      "厂商产品/计费项Code",
      "厂商产品/计费项名称",
    ],
  },
  {
    group: "厂商资源",
    keys: ["厂商资源/实例ID（出账粒度）"],
  },
  {
    group: "厂商定价",
    keys: [
      "厂商定价/官网目录价",
      "厂商定价/价格单位",
      "厂商定价/目录价用量阶梯",
      "厂商定价/定价币种",
    ],
  },
  {
    group: "厂商优惠",
    keys: ["厂商优惠/优惠金额", "厂商优惠/优惠详情"],
  },
];

export const ALL_DISPLAY_KEYS = BILL_COLUMN_GROUPS.flatMap((g) => g.keys);

/**
 * Admin-only 单列：用户隐藏，admin 可见。
 * - 「平台/用户ID」：内部 cuid。
 * - 「平台/系数(M)」：溢价系数属内部商业策略。
 * - 「平台/计费公式」（v007 Round 5 hotfix-2）：公式含 ×M 系数，会透露商业策略。
 *
 * 「平台/定价」「平台/扣点」「平台/应付金额」对用户可见。
 */
export const ADMIN_ONLY_KEYS: ReadonlySet<string> = new Set([
  "平台/用户ID",
  "平台/系数(M)",
  "平台/计费公式",
]);

/**
 * Admin-only 整组：用户视角下整组隐藏。
 *
 * v007 Round 5 hotfix-2：所有"厂商X"组对用户整组隐藏（产品 / 资源 / 定价 / 优惠 共 4 组 12 列）。
 * 用户视角最终：平台信息 7 列 + 平台账单 6 列 + 平台用量 3 列 = 16 列 / 3 组。
 */
export const ADMIN_ONLY_GROUPS: ReadonlySet<string> = new Set([
  "厂商产品",
  "厂商资源",
  "厂商定价",
  "厂商优惠",
]);

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
