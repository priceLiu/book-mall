import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { gatewayJson } from "@/lib/gateway-api";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard/guide", label: "操作指引" },
  { href: "/dashboard", label: "用量" },
  { href: "/dashboard/logs", label: "日志" },
  { href: "/dashboard/models", label: "模型管理" },
  { href: "/dashboard/keys", label: "API密钥" },
  { href: "/dashboard/playground", label: "API调试" },
  { href: "/dashboard/docs", label: "接入文档" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await gatewayJson<{
    user: {
      email: string;
      name: string | null;
      bookRole?: "ADMIN" | "USER";
    } | null;
  }>("/api/gateway/auth/session");
  if (!session.ok || !session.data?.user) {
    redirect("/login");
  }

  const user = session.data.user;
  const isAdmin = user.bookRole === "ADMIN";

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-[var(--gw-surface)]">
        <div className="border-b border-white/10 px-4 py-5">
          <div className="text-sm font-semibold text-white">Gateway 控制台</div>
          <div className="mt-1 truncate text-xs text-[var(--gw-muted)]">
            {user.name || user.email}
          </div>
          <div className="mt-2">
            <span
              className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                isAdmin
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                  : "border-white/15 bg-white/5 text-zinc-400"
              }`}
            >
              {isAdmin ? "Admin" : "User"}
            </span>
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
