import { Suspense } from "react";

import { AdminCockpitHashScroll } from "@/components/admin/admin-cockpit-hash-scroll";
import { AdminCockpitFinanceQuickLinks } from "@/components/admin/admin-cockpit-finance-quick-links";
import { AdminPlatformCockpitHeader } from "@/components/admin/admin-platform-cockpit";
import {
  AdminCockpitAssistantSection,
  AdminCockpitCreditOpsSection,
  AdminCockpitDailySection,
  AdminCockpitFinanceSection,
  AdminCockpitGatewayHealthSection,
  AdminCockpitMetricsSection,
  AdminCockpitUsageAuditSection,
} from "@/components/admin/admin-platform-cockpit-sections";
import {
  AdminCockpitAssistantSkeleton,
  AdminCockpitCreditOpsSkeleton,
  AdminCockpitDailySkeleton,
  AdminCockpitFinanceSkeleton,
  AdminCockpitMetricsSkeleton,
} from "@/components/admin/admin-platform-cockpit-skeletons";

/**
 * 平台驾驶舱 · 单页长滚动：顶部今日看板 + 财务快捷链 + 原有运维/KPI 模块。
 */
export function AdminCockpitScrollPage() {
  return (
    <div className="space-y-10 pb-12">
      <AdminCockpitHashScroll />
      <AdminPlatformCockpitHeader />

      <section id="today" className="scroll-mt-20 space-y-2">
        <h2 className="text-lg font-semibold text-[#1f2328]">今日看板</h2>
        <p className="text-sm text-[#656d76]">
          当日积分、生图/生视频、Gateway 与成本；可切换业务日并导出 CSV。
        </p>
        <Suspense fallback={<AdminCockpitDailySkeleton />}>
          <AdminCockpitDailySection embedInCockpit />
        </Suspense>
      </section>

      <AdminCockpitFinanceQuickLinks />

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <Suspense fallback={<AdminCockpitCreditOpsSkeleton />}>
          <AdminCockpitGatewayHealthSection />
        </Suspense>
        <Suspense fallback={<AdminCockpitCreditOpsSkeleton />}>
          <AdminCockpitCreditOpsSection />
        </Suspense>
      </div>

      <Suspense fallback={<AdminCockpitFinanceSkeleton />}>
        <AdminCockpitFinanceSection />
      </Suspense>

      <AdminCockpitUsageAuditSection />

      <Suspense fallback={<AdminCockpitAssistantSkeleton />}>
        <AdminCockpitAssistantSection />
      </Suspense>

      <section id="metrics" className="scroll-mt-20">
        <Suspense fallback={<AdminCockpitMetricsSkeleton />}>
          <AdminCockpitMetricsSection />
        </Suspense>
      </section>
    </div>
  );
}
