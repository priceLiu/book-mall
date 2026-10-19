import { AdminUsageAuditPanel } from "@/components/admin/admin-usage-audit-panel";
import {
  AdminPlatformCockpitAssistant,
  AdminPlatformCockpitCreditOps,
  AdminPlatformCockpitMetrics,
} from "@/components/admin/admin-platform-cockpit";
import { AdminTodayDashboard } from "@/components/admin/admin-today-dashboard";
import { AdminPlatformCockpitFinancePanel } from "@/components/admin/admin-platform-cockpit-finance-panel";
import { AdminGatewayHealthPanel } from "@/components/admin/admin-gateway-health-panel";
import {
  fetchPlatformCockpitAssistantSection,
  fetchPlatformCockpitCreditOpsSection,
  fetchPlatformCockpitDailySection,
  fetchPlatformCockpitFinanceSection,
  fetchPlatformCockpitMetricsSection,
} from "@/lib/admin/platform-cockpit-service";
import { getGatewayPublicOrigin } from "@/lib/gateway/env";
import { scanGatewayHealth } from "@/lib/gateway/gateway-health-service";

export async function AdminCockpitGatewayHealthSection() {
  const snapshot = await scanGatewayHealth({ source: "admin-cockpit" });
  return (
    <AdminGatewayHealthPanel
      initial={snapshot}
      gatewayOrigin={getGatewayPublicOrigin()}
      compact
    />
  );
}

export async function AdminCockpitCreditOpsSection() {
  const section = await fetchPlatformCockpitCreditOpsSection();
  return <AdminPlatformCockpitCreditOps {...section} />;
}

export async function AdminCockpitDailySection(options?: { embedInCockpit?: boolean }) {
  const { daily } = await fetchPlatformCockpitDailySection();
  return (
    <AdminTodayDashboard
      initialDaily={daily}
      gatewayOrigin={getGatewayPublicOrigin()}
      embedInCockpit={options?.embedInCockpit}
    />
  );
}

export async function AdminCockpitFinanceSection() {
  const section = await fetchPlatformCockpitFinanceSection();
  return <AdminPlatformCockpitFinancePanel initialFinance={section.finance} />;
}

export function AdminCockpitUsageAuditSection() {
  return <AdminUsageAuditPanel variant="cockpit" />;
}

export async function AdminCockpitAssistantSection() {
  const section = await fetchPlatformCockpitAssistantSection();
  return <AdminPlatformCockpitAssistant {...section} />;
}

export async function AdminCockpitMetricsSection() {
  const section = await fetchPlatformCockpitMetricsSection();
  return <AdminPlatformCockpitMetrics data={section} />;
}
