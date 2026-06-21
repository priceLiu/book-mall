import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { GatewayDatabaseUnavailable } from "@/components/gateway-database-unavailable";
import { LogoutButton } from "@/components/logout-button";
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
  const isAdmin = user.bookRole === "ADMIN";
  const isByok = user.billingPersona === "BYOK";
  const isPlatformPoolDelegate = Boolean(user.platformPoolDelegate);
  const nav =
    isByok || isPlatformPoolDelegate
      ? FULL_NAV
      : READONLY_NAV;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-[var(--gw-surface)]">
        <div className="border-b border-white/10 px-4 py-5">
          <div className="text-sm font-semibold text-white">Gateway 控制台</div>
          <div className="mt-1 truncate text-xs text-[var(--gw-muted)]">
            {user.name || user.phone || user.email}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <span
              className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                isAdmin
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                  : "border-white/15 bg-white/5 text-zinc-400"
              }`}
            >
              {isAdmin ? "Admin" : "User"}
            </span>
            <span className="inline-block rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
              {isByok ? "BYOK" : "平台代付"}
            </span>
            {isPlatformPoolDelegate ? (
              <span className="inline-block rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-200">
                平台池
              </span>
            ) : null}
          </div>
        </div>
        <DashboardNav items={nav} />
        <div className="p-3">
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
