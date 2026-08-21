import { Suspense } from "react";

import { AdminPlatformCockpitHeader } from "@/components/admin/admin-platform-cockpit";
import {
  AdminCockpitAssistantSection,
  AdminCockpitCreditOpsSection,
  AdminCockpitMetricsSection,
} from "@/components/admin/admin-platform-cockpit-sections";
import {
  AdminCockpitAssistantSkeleton,
  AdminCockpitCreditOpsSkeleton,
  AdminCockpitMetricsSkeleton,
} from "@/components/admin/admin-platform-cockpit-skeletons";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <AdminPlatformCockpitHeader />

      <Suspense fallback={<AdminCockpitCreditOpsSkeleton />}>
        <AdminCockpitCreditOpsSection />
      </Suspense>

      <Suspense fallback={<AdminCockpitAssistantSkeleton />}>
        <AdminCockpitAssistantSection />
      </Suspense>

      <Suspense fallback={<AdminCockpitMetricsSkeleton />}>
        <AdminCockpitMetricsSection />
      </Suspense>
    </div>
  );
}
