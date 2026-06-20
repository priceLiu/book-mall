import { StatusDashboard } from "@/components/status/status-dashboard";
import { gatewayJson } from "@/lib/gateway-api";

export const dynamic = "force-dynamic";

type DashboardMeta = {
  isPlatformAdmin: boolean;
  bookUserId: string | null;
  currentUser: {
    id: string;
    phone: string | null;
    name: string | null;
    displayLabel: string;
  } | null;
  teams: { id: string; name: string; type?: string }[];
};

export default async function StatusDashboardPage() {
  const { data } = await gatewayJson<DashboardMeta>(
    "/api/gateway/logs/dashboard/meta",
  );

  const initialMeta: DashboardMeta = {
    isPlatformAdmin: data?.isPlatformAdmin ?? false,
    bookUserId: data?.bookUserId ?? null,
    currentUser: data?.currentUser ?? null,
    teams: data?.teams ?? [],
  };

  return <StatusDashboard initialMeta={initialMeta} />;
}
