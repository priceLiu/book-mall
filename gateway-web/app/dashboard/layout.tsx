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

  // 主站 DB 瞬时不可用，或令牌过期/失效（无 user）：
  // 都交给客户端守卫做「自动换票 / 自动重连」（最多 6 次，无感）；
  // 6 次仍不行才在守卫内提示「重新登录」。直接服务端 redirect 会丢失静默换票机会。
  if (
    session.status === 503 ||
    session.status === 502 ||
    !session.ok ||
    !session.data?.user
  ) {
    return <GatewayReconnectGate>{children}</GatewayReconnectGate>;
  }

  const user = session.data.user;

  return (
    <DashboardShell user={user} nav={resolveGatewayDashboardNav(user)}>
      {children}
    </DashboardShell>
  );
}
