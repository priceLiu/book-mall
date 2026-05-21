"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, ListChecks, Tags, UserCircle2, Wrench } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { bookMallLoginHint } from "@/lib/book-mall-login-hint";

const nav = [
  { href: "/admin", label: "概览", icon: LayoutDashboard, exact: true },
  { href: "/admin/billing/users", label: "用户明细", icon: UserCircle2, prefix: "/admin/billing/users" },
  { href: "/admin/billing/all", label: "费用明细（全部）", icon: ListChecks, prefix: "/admin/billing/all" },
  { href: "/admin/pricing-disclosure", label: "价格公示", icon: Tags, prefix: "/admin/pricing-disclosure" },
  { href: "/admin/models/coefficients", label: "模型系数", icon: Wrench, prefix: "/admin/models" },
] as const;

type ViewerPayload = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    role: string;
  } | null;
};

export function AdminSidebar() {
  const pathname = usePathname();
  const base = useBookMallBaseUrl();
  const [viewer, setViewer] = useState<ViewerPayload["user"] | undefined>(undefined);
  const [viewerErr, setViewerErr] = useState<string | null>(null);

  useEffect(() => {
    if (!base) {
      setViewer(null);
      setViewerErr("未配置 NEXT_PUBLIC_BOOK_MALL_URL");
      return;
    }
    let cancelled = false;
    setViewerErr(null);
    setViewer(undefined);
    fetch(`${base}/api/finance/viewer-session`, { credentials: "include", mode: "cors", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<ViewerPayload>;
      })
      .then((j) => {
        if (!cancelled) setViewer(j.user);
      })
      .catch(() => {
        if (!cancelled) {
          setViewer(null);
          setViewerErr("无法读取主站登录态");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-[#e8e8e8] bg-[#001529] text-sm text-white/85">
      <div className="shrink-0 border-b border-white/10 px-3 py-3 leading-snug">
        {viewerErr ? (
          <p className="text-sm text-[#ffccc7]">
            {viewerErr}
            {base ? (
              <>
                {" "}
                <a
                  href={bookMallLoginHint(base, "admin").loginUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#91d5ff] underline"
                >
                  去主站登录
                </a>
              </>
            ) : null}
          </p>
        ) : viewer === undefined ? (
          <p className="text-sm text-white/45">加载中…</p>
        ) : viewer === null ? (
          <p className="text-sm text-white/70">
            未登录。请先在{" "}
            <a
              href={bookMallLoginHint(base, "admin").loginUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#91d5ff] underline"
            >
              主站登录
            </a>
            （管理员），再回到本页刷新。
          </p>
        ) : (
          <>
            <p className="text-base font-semibold text-white">{viewer.name?.trim() || "—"}</p>
            <p className="mt-1 break-all text-sm text-white/80">{viewer.email?.trim() || "—"}</p>
            <p className="mt-2 text-sm text-white/75">
              角色：{viewer.role === "ADMIN" ? "管理员" : viewer.role}
            </p>
          </>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            "exact" in item && item.exact
              ? pathname === item.href
              : "prefix" in item
                ? pathname.startsWith(item.prefix)
                : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded px-2 py-2",
                active ? "bg-[#1890ff] text-white" : "hover:bg-white/10",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
