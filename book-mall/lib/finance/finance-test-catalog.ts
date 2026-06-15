/**
 * 财务 2.0 自动化测试用例目录（与 `pnpm test` 43 条 vitest 一一对应）。
 * 文档映射见 docs/财务2.0-测试用例.md
 */
export type FinanceTestLayer = "unit" | "integration";
export type FinanceTestCategory =
  | "pricing"
  | "reconciliation"
  | "simulation"
  | "scenario-lab"
  | "pnl"
  | "permissions";

export interface FinanceTestCase {
  id: string;
  /** 文档编号，如 TC-A1 */
  docId: string;
  category: FinanceTestCategory;
  layer: FinanceTestLayer;
  suite: string;
  title: string;
  file: string;
  /** vitest 完整路径匹配用 */
  fullName: string;
  command: string;
}

export const FINANCE_TEST_CATEGORIES: Record<
  FinanceTestCategory,
  { label: string; docSection: string }
> = {
  pricing: { label: "积分换算与护栏", docSection: "TC-A1～A4" },
  reconciliation: { label: "对账差异", docSection: "TC-A5 / TC-B5" },
  simulation: { label: "调价六维测算", docSection: "TC-B7" },
  "scenario-lab": { label: "Scenario Lab 验算", docSection: "TC-D1 / TC-D2" },
  pnl: { label: "盈亏预警", docSection: "§2.5" },
  permissions: { label: "角色 RBAC", docSection: "§2.6" },
};

const UNIT_CMD = "pnpm exec vitest run";
const FILE = {
  pricing: "test/unit/credit-pricing-formulas.test.ts",
  reconciliation: "test/unit/reconciliation-diff.test.ts",
  simulation: "test/unit/pricing-simulation.test.ts",
  scenarioLab: "test/unit/scenario-lab.test.ts",
  pnl: "test/unit/pnl-alerts.test.ts",
  permissions: "test/unit/permissions.test.ts",
  integrationScenario: "test/integration/scenario-lab.integration.ts",
  integrationVideo: "test/integration/finance-2.0-video.integration.ts",
} as const;

function unit(
  id: string,
  docId: string,
  category: FinanceTestCategory,
  suite: string,
  title: string,
  file: string,
): FinanceTestCase {
  const fullName = `${suite} ${title}`;
  return {
    id,
    docId,
    category,
    layer: "unit",
    suite,
    title,
    file,
    fullName,
    command: `${UNIT_CMD} ${file}`,
  };
}

/** vitest 单测 43 条（与 pnpm test 计数一致） */
export const FINANCE_VITEST_CATALOG: FinanceTestCase[] = [
  // credit-pricing-formulas (14)
  ...[
    ["标准版 → 704 积分/条", "TC-A1"],
    ["进阶版 → 979 积分/条", "TC-A1"],
    ["高级版 → 1057 积分/条", "TC-A1"],
    ["豪华版 → 1136 积分/条", "TC-A1"],
    ["至尊版 → 1216 积分/条", "TC-A1"],
    ["团队高级版 → 841 积分/条", "TC-A1"],
    ["团队豪华版 → 831 积分/条", "TC-A1"],
    ["团队至尊版 → 912 积分/条", "TC-A1"],
  ].map(([title, docId], i) =>
    unit(
      `pricing-tier-${i + 1}`,
      docId,
      "pricing",
      "computeTierCredits — 逐档积分换算（验收表 §1.1/§1.2）",
      title,
      FILE.pricing,
    ),
  ),
  unit(
    "pricing-margin-all-tiers",
    "TC-A2",
    "pricing",
    "computeTierCredits — 逐档积分换算（验收表 §1.1/§1.2）",
    "贵视频各档实测毛利 ≈ 0%（取整容差 ±1pct）",
    FILE.pricing,
  ),
  unit(
    "pricing-video-cap-over",
    "TC-A3",
    "pricing",
    "videoBillableSeconds — 15s 封顶",
    "超 15s 封顶 15",
    FILE.pricing,
  ),
  unit(
    "pricing-video-cap-under",
    "TC-A3",
    "pricing",
    "videoBillableSeconds — 15s 封顶",
    "不足 15s 据实",
    FILE.pricing,
  ),
  unit(
    "pricing-video-cap-default",
    "TC-A3",
    "pricing",
    "videoBillableSeconds — 15s 封顶",
    "缺省时长取封顶",
    FILE.pricing,
  ),
  unit(
    "pricing-video-cap-min",
    "TC-A3",
    "pricing",
    "videoBillableSeconds — 15s 封顶",
    "至少 1s",
    FILE.pricing,
  ),
  unit(
    "pricing-guard-video",
    "TC-A4",
    "pricing",
    "分类系数与护栏",
    "视频（PER_SEC）分档 M=1.0/1.5 / 护栏 -0.02",
    FILE.pricing,
  ),
  unit(
    "pricing-guard-image",
    "TC-A4",
    "pricing",
    "分类系数与护栏",
    "图像（PER_IMAGE）取默认 M=2.5 / 护栏 0.3",
    FILE.pricing,
  ),
  unit(
    "pricing-happyhorse-unit",
    "TC-A1",
    "pricing",
    "computeCreditPrice — happyhorse 单位报价",
    "net 0.81 / M=1.0 → 挂牌 0.81、20 积分/秒、毛利 ≈0%",
    FILE.pricing,
  ),
  // reconciliation-diff (7)
  unit(
    "recon-ok",
    "TC-A5",
    "reconciliation",
    "diffReconciliation — 视频成本三端对账（容差 5%）",
    "厂商账单一致 → OK",
    FILE.reconciliation,
  ),
  unit(
    "recon-over",
    "TC-A5",
    "reconciliation",
    "diffReconciliation — 视频成本三端对账（容差 5%）",
    "厂商偏高且超容差 → OVER（diff>0）",
    FILE.reconciliation,
  ),
  unit(
    "recon-over-tolerance",
    "TC-A5",
    "reconciliation",
    "diffReconciliation — 视频成本三端对账（容差 5%）",
    "厂商偏高但在 5% 容差内 → OK",
    FILE.reconciliation,
  ),
  unit(
    "recon-under",
    "TC-A5",
    "reconciliation",
    "diffReconciliation — 视频成本三端对账（容差 5%）",
    "厂商偏低且超容差 → UNDER（diff<0）",
    FILE.reconciliation,
  ),
  unit(
    "recon-missing-vendor",
    "TC-A5",
    "reconciliation",
    "diffReconciliation — 视频成本三端对账（容差 5%）",
    "仅内部有记录 → MISSING_VENDOR",
    FILE.reconciliation,
  ),
  unit(
    "recon-missing-internal",
    "TC-A5",
    "reconciliation",
    "diffReconciliation — 视频成本三端对账（容差 5%）",
    "仅厂商有记录 → MISSING_INTERNAL",
    FILE.reconciliation,
  ),
  unit(
    "recon-total",
    "TC-A5",
    "reconciliation",
    "diffReconciliation — 视频成本三端对账（容差 5%）",
    "总额聚合正确",
    FILE.reconciliation,
  ),
  // scenario-lab (2)
  unit(
    "scenario-personal-30",
    "TC-D1",
    "scenario-lab",
    "scenario-lab 毛利验算",
    "个人高级版 30 行毛利符合 M 分档（贵视频≈0%、普通≈33%）",
    FILE.scenarioLab,
  ),
  unit(
    "scenario-team-30",
    "TC-D2",
    "scenario-lab",
    "scenario-lab 毛利验算",
    "团队高级版（4席）30 行毛利符合 M 分档",
    FILE.scenarioLab,
  ),
  // pnl-alerts (6)
  unit("pnl-healthy", "§2.5", "pnl", "evaluateAlerts — 多级盈亏预警阈值（Phase 5）", "各项健康 → 无预警", FILE.pnl),
  unit(
    "pnl-blended-warn",
    "§2.5",
    "pnl",
    "evaluateAlerts — 多级盈亏预警阈值（Phase 5）",
    "综合毛利 < 75% → 预警；跌破 70% → CRITICAL",
    FILE.pnl,
  ),
  unit(
    "pnl-video-warn",
    "§2.5",
    "pnl",
    "evaluateAlerts — 多级盈亏预警阈值（Phase 5）",
    "视频毛利 < 70% → 预警；跌破 65% → CRITICAL",
    FILE.pnl,
  ),
  unit(
    "pnl-cost-spike",
    "§2.5",
    "pnl",
    "evaluateAlerts — 多级盈亏预警阈值（Phase 5）",
    "单日视频成本环比 +50% → 预警；翻倍 → CRITICAL",
    FILE.pnl,
  ),
  unit(
    "pnl-waste",
    "§2.5",
    "pnl",
    "evaluateAlerts — 多级盈亏预警阈值（Phase 5）",
    "积分损耗率 > 15% → 预警；> 30% → CRITICAL",
    FILE.pnl,
  ),
  unit("pnl-null", "§2.5", "pnl", "evaluateAlerts — 多级盈亏预警阈值（Phase 5）", "null 指标不触发", FILE.pnl),
  // pricing-simulation (8)
  unit(
    "sim-base-cost",
    "TC-B7",
    "simulation",
    "simulatePlanChange — 六维测算（Phase 4）",
    "单次基础成本 = 12.15",
    FILE.simulation,
  ),
  unit(
    "sim-credits-table",
    "TC-B7",
    "simulation",
    "simulatePlanChange — 六维测算（Phase 4）",
    "各档扣分匹配验收表",
    FILE.simulation,
  ),
  unit(
    "sim-margin-pass",
    "TC-B7",
    "simulation",
    "simulatePlanChange — 六维测算（Phase 4）",
    "M=1.0 贵视频全档毛利护栏通过（≈0%）",
    FILE.simulation,
  ),
  unit(
    "sim-margin-fail",
    "TC-B7",
    "simulation",
    "护栏拦截 — 挂牌低于成本",
    "worstMargin < 护栏 → allPassed=false",
    FILE.simulation,
  ),
  unit(
    "sim-revenue",
    "TC-B7",
    "simulation",
    "simulateRevenue — 营收模拟",
    "综合毛利按成本上限保守口径计算",
    FILE.simulation,
  ),
  unit(
    "sim-reverse-a",
    "TC-B7",
    "simulation",
    "reverseTargetMargin — 模式 A（目标毛利反推）",
    "目标 33% → M≈1.5、单位挂牌价 1.215",
    FILE.simulation,
  ),
  unit(
    "sim-reverse-b-safe",
    "TC-B7",
    "simulation",
    "reverseBreakEven — 模式 B（保本线核验）",
    "当前扣分（验收表）均高于保本线 → safe",
    FILE.simulation,
  ),
  unit(
    "sim-reverse-b-unsafe",
    "TC-B7",
    "simulation",
    "reverseBreakEven — 模式 B（保本线核验）",
    "扣分过低 → 触发亏本（unsafe）",
    FILE.simulation,
  ),
  // permissions (6)
  unit(
    "perm-cost",
    "§2.6",
    "permissions",
    "五级角色 RBAC（Phase 6）",
    "厂商成本/反向验算：仅财务 + 超管 + legacy ADMIN 可见",
    FILE.permissions,
  ),
  unit(
    "perm-pricing",
    "§2.6",
    "permissions",
    "五级角色 RBAC（Phase 6）",
    "管理报价 = 同财务可见集合",
    FILE.permissions,
  ),
  unit(
    "perm-finance-review",
    "§2.6",
    "permissions",
    "五级角色 RBAC（Phase 6）",
    "财务复核：财务 + 超管",
    FILE.permissions,
  ),
  unit(
    "perm-final",
    "§2.6",
    "permissions",
    "五级角色 RBAC（Phase 6）",
    "终审生效：仅超管 + legacy ADMIN",
    FILE.permissions,
  ),
  unit(
    "perm-proposal",
    "§2.6",
    "permissions",
    "五级角色 RBAC（Phase 6）",
    "提交调价提案：运营及以上",
    FILE.permissions,
  ),
  unit(
    "perm-rank",
    "§2.6",
    "permissions",
    "五级角色 RBAC（Phase 6）",
    "isPlatformStaff / roleRank 单调递增",
    FILE.permissions,
  ),
];

/** 集成脚本（非 vitest 计数，供页面「扩展用例」展示） */
export const FINANCE_INTEGRATION_SCRIPTS: FinanceTestCase[] = [
  {
    id: "int-scenario-lab",
    docId: "TC-D1/D2",
    category: "scenario-lab",
    layer: "integration",
    suite: "scenario-lab.integration",
    title: "个人 + 团队各 30 行 mock settle（合计 60 次）+ 毛利校验",
    file: FILE.integrationScenario,
    fullName: "scenario-lab.integration",
    command: "pnpm exec tsx test/integration/scenario-lab.integration.ts",
  },
  {
    id: "int-video-finance",
    docId: "TC-B1～B6",
    category: "pricing",
    layer: "integration",
    suite: "finance-2.0-video.integration",
    title: "RESERVE→SETTLE、RELEASE、视频池隔离、团队分账",
    file: FILE.integrationVideo,
    fullName: "finance-2.0-video.integration",
    command: "pnpm test:finance-integration",
  },
];

export function buildFinanceTestCatalogPayload() {
  const byCategory = Object.keys(FINANCE_TEST_CATEGORIES).map((key) => {
    const cat = key as FinanceTestCategory;
    const cases = FINANCE_VITEST_CATALOG.filter((c) => c.category === cat);
    return { category: cat, ...FINANCE_TEST_CATEGORIES[cat], count: cases.length, cases };
  });
  return {
    vitestTotal: FINANCE_VITEST_CATALOG.length,
    integrationScripts: FINANCE_INTEGRATION_SCRIPTS,
    byCategory,
    allVitest: FINANCE_VITEST_CATALOG,
    runAllCommand: "pnpm test",
    docPath: "docs/财务2.0-测试用例.md",
  };
}
