import Link from "next/link";

import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

/**
 * P&L 在 finance-web 展示。若未配置财务站域名则回退；否则跳转前给出说明，避免用户误以为「驾驶舱打不开」。
 */
export default function PnlReportRedirectPage() {
  const financeOrigin = getFinanceWebPublicOrigin();
  if (!financeOrigin) {
    redirectToFinanceWeb("/admin/pnl-report");
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-[#d1d9e0] bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-[#1f2328]">P&amp;L 报表在财务控制台</h1>
      <p className="text-sm leading-relaxed text-[#656d76]">
        该页在 <strong className="font-medium text-[#1f2328]">finance-web</strong>（本地一般为{" "}
        <code className="rounded bg-[#f6f8fa] px-1">localhost:3002</code>）打开，需 Book 主站（{" "}
        <code className="rounded bg-[#f6f8fa] px-1">localhost:3000</code>）已登录且 dev:all 在跑。
      </p>
      <p className="text-sm text-[#656d76]">
        <strong className="font-medium text-[#1f2328]">平台驾驶舱 · 今日看板</strong> 在主站{" "}
        <Link href="/admin/today" className="text-[#0969da] hover:underline">
          /admin/today
        </Link>
        ，不在财务站侧栏内。
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        <a
          href={`${financeOrigin}/admin/pnl-report`}
          className="rounded-md bg-[#0969da] px-4 py-2 text-sm font-medium text-white hover:bg-[#0550ae]"
        >
          继续打开 P&amp;L →
        </a>
        <Link
          href="/admin/today"
          className="rounded-md border border-[#d1d9e0] px-4 py-2 text-sm font-medium text-[#1f2328] hover:border-[#0969da]"
        >
          今日看板
        </Link>
      </div>
    </div>
  );
}
