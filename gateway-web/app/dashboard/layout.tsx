import { redirect } from "next/navigation";
import { GatewayReconnectGate } from "@/components/gateway-reconnect-gate";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  resolveGatewayDashboardNav,
  type GatewayDashboardUser,
} from "@/lib/gateway-dashboard-nav";
import { gatewayJson } from "@/lib/gateway-api";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await gatewayJson<{
    user: GatewayDashboardUser | null;
  }>("/api/gateway/auth/session");

  if (session.status === 503 || session.status === 502) {
    return <GatewayReconnectGate>{children}</GatewayReconnectGate>;
  }

  if (!session.ok || !session.data?.user) {
    redirect("/login");
  }

  const user = session.data.user;

  return (
    <DashboardShell user={user} nav={resolveGatewayDashboardNav(user)}>
      {children}
    </DashboardShell>
  );
}
