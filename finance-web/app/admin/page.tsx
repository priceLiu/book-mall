import Link from "next/link";

const cards = [
  { href: "/admin/help", title: "财务 2.0 使用说明", desc: "积分换算口径、角色权限、调价流程与模块导航。" },
  { href: "/admin/billing/users", title: "按用户查看账单明细", desc: "财务管理员 · 31 列费用明细。" },
  { href: "/admin/billing/all", title: "费用明细（全部）", desc: "财务管理员 · 全站云级账单行。" },
  { href: "/admin/usage-overview", title: "费用多维度概览", desc: "按月份/工具/模型/用户聚合。" },
  { href: "/admin/pnl-alerts", title: "盈亏预警中心", desc: "综合毛利 / 视频毛利 / 成本环比。" },
  { href: "/admin/plan-change", title: "调价测算与审批", desc: "运营→财务→超管审批流。" },
  { href: "/admin/model-cost", title: "模型成本", desc: "仅财务管理员 · 渠道折扣与净成本。" },
  { href: "/admin/credit-pricing", title: "积分报价计算器", desc: "发布对外模型积分价。" },
  { href: "/admin/test-cases", title: "财务测算", desc: "个人/团队日消耗与月汇总：积分、成本、收入、利润。" },
  { href: "/admin/membership-plans", title: "会员套餐", desc: "个人/团队套餐与席位带。" },
  { href: "/admin/byok", title: "BYOK 定价与核算", desc: "两档月费、任务额度、超额扣分与实账观测。" },
  { href: "/admin/reconciliation", title: "云账单对账", desc: "上传 CSV 对账与补扣。" },
  { href: "/admin/models/coefficients", title: "模型 / 零售系数", desc: "逐工具独立配置系数 M。" },
  { href: "/admin/pricing-disclosure", title: "价格公示", desc: "与前台公示页共用价目表。" },
];

export default function AdminHomePage() {
  return (
    <div className="p-6">
      <h1 className="mb-4 text-lg font-medium text-[#262626]">财务控制台 · 系统管理</h1>
      <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="block rounded border border-[#e8e8e8] bg-white p-4 hover:border-[#1890ff] hover:shadow-sm"
          >
            <div className="mb-1 text-base font-medium text-[#262626]">{c.title} →</div>
            <div className="text-xs text-[#8c8c8c]">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
