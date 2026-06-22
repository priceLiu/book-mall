export type AdminNavLink = {
  label: string;
  href: string;
  /** 新标签打开（前台公示等） */
  external?: boolean;
  /** 依赖 finance-web 公网域名；未配置时禁用 */
  requiresFinanceWeb?: boolean;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavLink[];
};

const CREDIT_LEDGER_TYPE_LABEL: Record<string, string> = {
  CONSUME: "生成扣减",
  SETTLE: "视频结算扣减",
  GRANT: "套餐发放",
  TOPUP: "积分包充值",
  REFUND: "失败返还",
  RESERVE: "视频冻结",
  RELEASE: "解冻返还",
  EXPIRE: "周期过期",
  ADJUST: "人工校正",
};

export function creditLedgerTypeLabel(type: string): string {
  return CREDIT_LEDGER_TYPE_LABEL[type] ?? type;
}

function fin(
  origin: string | null,
  path: string,
  label: string,
  bookFallback: string,
): AdminNavLink {
  if (origin) {
    return { label, href: `${origin}${path}`, external: true };
  }
  return { label, href: bookFallback };
}

/** 管理后台顶栏 / 移动抽屉共用导航结构 */
export function buildAdminNavGroups(financeWebOrigin: string | null): AdminNavGroup[] {
  const o = financeWebOrigin;

  return [
    {
      id: "book-ops",
      label: "Book 运营",
      items: [
        { label: "支付核对", href: "/admin/payments" },
        { label: "课程订阅", href: "/admin/billing" },
        { label: "提现审核", href: "/admin/refunds" },
      ],
    },
    {
      id: "finance",
      label: "财务控制台",
      items: [
        fin(o, "/admin/usage-overview", "费用多维度概览", "/admin/finance/usage-overview"),
        fin(o, "/admin/reconciliation", "云账单对账", "/admin/finance/reconciliation"),
        fin(o, "/admin/model-cost", "模型成本与折扣", "/admin/finance/model-cost"),
        fin(o, "/admin/credit-pricing", "积分报价计算器", "/admin/finance/credit-pricing"),
        fin(o, "/admin/membership-plans", "工具会员套餐与席位", "/admin/finance/membership-plans"),
        fin(o, "/admin/plan-change", "调价测算与审批", "/admin/finance/plan-change"),
        fin(o, "/admin/pnl-alerts", "盈亏预警中心", "/admin/finance/pnl-alerts"),
        fin(o, "/admin/pnl-report", "盈亏报表", "/admin/finance/pnl-alerts"),
        fin(o, "/admin/billing/users", "账单明细（按用户）", "/admin/finance/usage-overview"),
        fin(o, "/admin/teams", "团队与租户", "/admin/finance/usage-overview"),
        fin(o, "/admin/platform-models", "平台模型登记", "/admin/finance/model-cost"),
        fin(o, "/admin/video-risk", "视频风控", "/admin/finance/usage-overview"),
        fin(o, "/admin/scenario-lab", "场景实验室", "/admin/finance/credit-pricing"),
        fin(o, "/admin/model-credit-ledger", "模型积分流水", "/admin/finance/usage-overview"),
      ],
    },
    {
      id: "public",
      label: "对外公示",
      items: [
        { label: "对外报价页（积分）", href: "/pricing", external: true },
        { label: "平台价目表（前台）", href: "/pricing-disclosure", external: true },
      ],
    },
    {
      id: "content",
      label: "产品与内容",
      items: [
        { label: "产品分类", href: "/admin/categories" },
        { label: "产品管理", href: "/admin/products" },
      ],
    },
    {
      id: "tools",
      label: "工具与应用",
      items: [
        { label: "工具菜单", href: "/admin/tool-apps/tool-menu" },
        { label: "Platform SSO 客户端", href: "/admin/sso-clients" },
        { label: "Gateway 平台凭证池", href: "/admin/gateway/platform" },
        { label: "工具管理", href: "/admin/tool-apps/manage" },
        { label: "资源库（图/视频）", href: "/admin/tool-libraries" },
        { label: "快速复制模板", href: "/admin/quick-replica/templates" },
        { label: "工具站跳转测试", href: "/admin/tools-sso-test" },
      ],
    },
  ];
}

/** 桌面顶栏：单链 + 下拉分组（不含对外公示，改由概览页链出） */
export const ADMIN_TOP_LEVEL_LINKS = [
  { label: "概览", href: "/admin" },
  { label: "用户", href: "/admin/users" },
  { label: "账号安全", href: "/admin/security" },
] as const;

export function adminNavGroupsForDesktop(financeWebOrigin: string | null): AdminNavGroup[] {
  return buildAdminNavGroups(financeWebOrigin).filter((g) => g.id !== "public");
}
