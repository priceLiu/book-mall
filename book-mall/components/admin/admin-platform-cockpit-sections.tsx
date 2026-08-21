import {
  fetchPlatformCockpitAssistantSection,
  fetchPlatformCockpitCreditOpsSection,
  fetchPlatformCockpitMetricsSection,
} from "@/lib/admin/platform-cockpit-service";
import {
  AdminPlatformCockpitAssistant,
  AdminPlatformCockpitCreditOps,
  AdminPlatformCockpitMetrics,
} from "@/components/admin/admin-platform-cockpit";

export async function AdminCockpitCreditOpsSection() {
  const section = await fetchPlatformCockpitCreditOpsSection();
  return <AdminPlatformCockpitCreditOps {...section} />;
}

export async function AdminCockpitAssistantSection() {
  const section = await fetchPlatformCockpitAssistantSection();
  return <AdminPlatformCockpitAssistant {...section} />;
}

export async function AdminCockpitMetricsSection() {
  const section = await fetchPlatformCockpitMetricsSection();
  return <AdminPlatformCockpitMetrics data={section} />;
}
