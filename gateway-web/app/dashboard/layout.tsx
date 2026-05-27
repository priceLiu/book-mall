import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { gatewayJson } from "@/lib/gateway-api";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard/guide", label: "操作指引" },
  { href: "/dashboard", label: "用量" },
  { href: "/dashboard/logs", label: "日志" },
  { href: "/dashboard/models", label: "接入模型" },
  { href: "/dashboard/keys", label: "API密钥" },
  { href: "/dashboard/playground", label: "API调试" },
  { href: "/dashboard/credentials", label: "厂商凭证" },
  { href: "/dashboard/docs", label: "接入文档" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await gatewayJson<{ user: { email: string; name: string | null } | null }>(
    "/api/gateway/auth/session",
  );
  if (!session.ok || !session.data?.user) {
    redirect("/login");
  }

  const user = session.data.user;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-[var(--gw-surface)]">
        <div className="border-b border-white/10 px-4 py-5">
          <div className="text-sm font-semibold text-white">Gateway 控制台</div>
          <div className="mt-1 truncate text-xs text-[var(--gw-muted)]">
            {user.name || user.email}
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-[var(--gw-muted)] transition hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3">
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
