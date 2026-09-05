import { Suspense } from "react";

import { AdminPlatformCockpitHeader } from "@/components/admin/admin-platform-cockpit";
import {
  AdminCockpitAssistantSection,
  AdminCockpitCreditOpsSection,
  AdminCockpitFinanceSection,
  AdminCockpitGatewayHealthSection,
  AdminCockpitMetricsSection,
  AdminCockpitUsageAuditSection,
} from "@/components/admin/admin-platform-cockpit-sections";
import {
  AdminCockpitAssistantSkeleton,
  AdminCockpitCreditOpsSkeleton,
  AdminCockpitFinanceSkeleton,
  AdminCockpitMetricsSkeleton,
} from "@/components/admin/admin-platform-cockpit-skeletons";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <AdminPlatformCockpitHeader />

      <Suspense fallback={<AdminCockpitCreditOpsSkeleton />}>
        <AdminCockpitGatewayHealthSection />
      </Suspense>

      <Suspense fallback={<AdminCockpitCreditOpsSkeleton />}>
        <AdminCockpitCreditOpsSection />
      </Suspense>

      <Suspense fallback={<AdminCockpitFinanceSkeleton />}>
        <AdminCockpitFinanceSection />
      </Suspense>

      <AdminCockpitUsageAuditSection />

      <Suspense fallback={<AdminCockpitAssistantSkeleton />}>
        <AdminCockpitAssistantSection />
      </Suspense>

      <Suspense fallback={<AdminCockpitMetricsSkeleton />}>
        <AdminCockpitMetricsSection />
      </Suspense>
    </div>
  );
}
