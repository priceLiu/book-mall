/**
 * 费用明细列定义（v007 / 2026-05-17，Round 5 终版）。
 *
 * 设计原则：**「我们的费用明细 = 仿阿里云 CSV 字段结构 + 平台计算结果归平台组」**。
 * 财务/运营打开任何一行能与阿里云后台同字段对照，免去脑内"我方字段 ↔ 云字段"翻译。
 *
 * 命名规则（关键）：列头前缀按 **"谁算 / 谁的钱"** 标注：
 *   - 「平台/X」= 由平台计算 or 用户对平台支付（包含系数 M 的任何字段都属于平台）；
 *   - 「厂商X」= 云厂商原始口径（按官网挂牌价、不含我方系数）。
 *
 * Round 5 调整（相比 Round 4）：
 *   1. 删除「厂商费用/目录总价」——admin 心算可得（厂商定价/官网目录价 × 平台用量/用量），列里展示纯冗余；
 *   2. 「厂商费用/计费公式」→「平台/计费公式」（公式里有 ×2 = 系数 M，是平台计算逻辑）；
 *   3. 「厂商应付/应付金额（含税）」→「平台/应付金额」（TOOL_USAGE_GENERATED 行 = 用户对平台应付；CSV 行 = 平台对云应付，admin 视角靠 source 区分语义）。
 *
 * 列归属（v007 终版：7 组 31 列）：
 *   - **平台信息（10）**：用户ID/用户名 + 产品Code/产品名称/计费项Code + 系数(M) + 定价 + 扣点 + 计费公式 + 应付金额
 *   - **平台账单（6）**：账单月份/日期/费用类型/消费/服务开始/服务结束（B-G）
 *   - **平台用量（3）**：抵扣前用量/用量/用量单位（P/R/S）
 *   - **厂商产品（5）**：阿里云 CSV 原 "产品信息" 组（H-L）
 *   - **厂商资源（1）**：实例ID（出账粒度）
 *   - **厂商定价（4）**：官网目录价/价格单位/目录价用量阶梯/定价币种
 *   - **厂商优惠（2）**：优惠金额/优惠详情（财务对账核算字段）
 *
 * 与 `finance-web/lib/bill-config.ts` 严格保持镜像同步。
 */

export type ColumnGroup = { group: string; keys: string[] };

export const BILL_COLUMN_GROUPS: ColumnGroup[] = [
  {
    group: "平台信息",
    keys: [
      // admin-only：内部 cuid，对内反查工单/钱包流水必须有
      "平台/用户ID",
      // 显示用：邮箱 / 手机 / 昵称
      "平台/用户名",
      // canonical key（与 ModelCatalog 对齐）
      "平台/产品Code",
      // 显示名（与 ModelCatalog.displayName 对齐）
      "平台/产品名称",
      // `${toolKey}:${action}`
      "平台/计费项Code",
      // admin-only：对外溢价系数 M（默认 2，按 ToolBillablePrice.schemeAAdminRetailMultiplier 逐行可配）
      "平台/系数(M)",
      // 我方挂牌单价 = 云挂牌价 × M
      "平台/定价",
      // 用户钱包实际扣点
      "平台/扣点",
      // v007 Round 5：包含 ×M（系数）的整条计算式 → 是平台口径，不是云口径
      "平台/计费公式",
      // v007 Round 5：TOOL_USAGE_GENERATED 行 = 用户对平台应付（= 扣点折元）；CSV 行 = 平台对云应付
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
      // 值为 `[0,9999999999999]` 时前端折叠为「无阶梯」
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
 * Admin-only：以下列对终端用户隐藏，仅在管理员视角可见。
 *
 * - 「平台/用户ID」：内部 cuid，对用户无意义且不应外泄。
 * - 「平台/系数(M)」：溢价系数属内部商业策略，不在用户账单展示。
 * - 「平台/计费公式」（v007 Round 5 hotfix-2）：公式里含 ×M（系数）= 透露商业策略；
 *   用户只看「平台/定价 + 平台/扣点 + 平台/应付金额」三个结果列即可。
 *
 * 「平台/定价」「平台/扣点」「平台/应付金额」对用户可见——他们应该知道单价、扣点和应付总额。
 */
export const ADMIN_ONLY_KEYS: ReadonlySet<string> = new Set([
  "平台/用户ID",
  "平台/系数(M)",
  "平台/计费公式",
]);

/**
 * Admin-only 整组：用户视角下整组隐藏。
 *
 * v007 Round 5 hotfix-2（用户反馈"全部厂商的都不见"）：所有 "厂商X" 组对用户整组隐藏。
 *
 *   - 厂商产品 5 列：阿里云口径商品命名，对账后台才需要；
 *   - 厂商资源 1 列：阿里云实例ID，对用户不可读；
 *   - 厂商定价 4 列：云挂牌价 / 阶梯 / 币种——含商业敏感的"成本基线"，不向用户暴露；
 *   - 厂商优惠 2 列：云端折扣明细，是平台利润空间。
 *
 * 用户视角只剩「平台信息（7 列）+ 平台账单（6 列）+ 平台用量（3 列）」共 16 列 / 3 组——干净对账视图。
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
