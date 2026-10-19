import Link from "next/link";

import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

/** 驾驶舱内保留的快捷入口：仅跳转 finance-web（或未配置时走 Book 重定向页） */
const FINANCE_QUICK_LINKS = [
  { title: "P&L 报表", href: "/admin/finance/pnl-report", desc: "账期盈亏" },
  { title: "对账总账", href: "/admin/finance/reconciliation", desc: "厂商与用户侧对账" },
  { title: "费用概览", href: "/admin/finance/usage-overview", desc: "多维度费用" },
  { title: "用量对账中心", href: "/admin/finance/usage-management", desc: "Gateway 用量" },
  { title: "模型积分流水", href: "/admin/finance/model-credit-ledger", desc: "按模型扣减" },
  { title: "积分清零控制台", href: "/admin/finance/credit-expiry-ops", desc: "周期清零运维" },
  { title: "模型成本", href: "/admin/finance/model-cost", desc: "折扣与单价" },
  { title: "VIP 大额预充", href: "/admin/finance/vip-ops", desc: "预充与审批" },
] as const;

export function AdminCockpitFinanceQuickLinks() {
  const financeOrigin = getFinanceWebPublicOrigin();

  return (
    <section aria-labelledby="cockpit-finance-quick-links" className="space-y-3">
      <div>
        <h2 id="cockpit-finance-quick-links" className="text-sm font-semibold text-[#1f2328]">
          财务控制台快捷入口
        </h2>
        <p className="mt-0.5 text-xs text-[#656d76]">
          以下模块在 finance-web 打开
          {financeOrigin ? (
            <>
              （<span className="font-mono">{financeOrigin.replace(/^https?:\/\//, "")}</span>）
            </>
          ) : (
            <>；未配置域名时将经 Book 重定向页跳转</>
          )}
          。今日看板与 Gateway / 积分运维在本页下方。
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FINANCE_QUICK_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-[#d1d9e0] bg-white p-4 transition-shadow hover:border-[#8c959f] hover:shadow-sm"
          >
            <span className="font-semibold text-[#1f2328]">{item.title}</span>
            <p className="mt-1 text-xs leading-snug text-[#656d76]">{item.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
