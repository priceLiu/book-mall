import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { GatewayDatabaseUnavailable } from "@/components/gateway-database-unavailable";
import { gatewayJson } from "@/lib/gateway-api";

export const dynamic = "force-dynamic";

const BASE_NAV = [
  { href: "/dashboard/guide", label: "操作指引" },
  { href: "/dashboard", label: "用量" },
  { href: "/dashboard/logs", label: "日志" },
  { href: "/dashboard/status", label: "状态" },
  { href: "/dashboard/poll-pool", label: "轮询池" },
  { href: "/dashboard/market", label: "模型市场" },
];

const FULL_NAV = [
  ...BASE_NAV,
  { href: "/dashboard/models", label: "模型管理" },
  { href: "/dashboard/keys", label: "API密钥" },
  { href: "/dashboard/playground", label: "API调试" },
  { href: "/dashboard/docs", label: "接入文档" },
];

const READONLY_NAV = BASE_NAV;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await gatewayJson<{
    user: {
      email: string;
      phone?: string | null;
      name: string | null;
      bookRole?: "ADMIN" | "USER";
      billingPersona?: "PLATFORM_CREDIT" | "BYOK" | null;
      platformPoolDelegate?: { canonicalOwnerEmail: string } | null;
    } | null;
  }>("/api/gateway/auth/session");
  if (session.status === 503) {
    const msg =
      session.data &&
      typeof session.data === "object" &&
      "message" in session.data &&
      typeof (session.data as { message?: unknown }).message === "string"
        ? (session.data as { message: string }).message
        : undefined;
    return <GatewayDatabaseUnavailable message={msg} />;
  }
  if (!session.ok || !session.data?.user) {
    redirect("/login");
  }

  const user = session.data.user;
  const isByok = user.billingPersona === "BYOK";
  const isPlatformPoolDelegate = Boolean(user.platformPoolDelegate);
  const nav =
    isByok || isPlatformPoolDelegate
      ? FULL_NAV
      : READONLY_NAV;

  return (
    <DashboardShell user={user} nav={nav}>
      {children}
    </DashboardShell>
  );
}
