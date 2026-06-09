"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Beaker,
  Calculator,
  CloudUpload,
  Coins,
  FileSpreadsheet,
  GitPullRequest,
  HelpCircle,
  KeyRound,
  Layers,
  LayoutDashboard,
  ClipboardList,
  ListChecks,
  Tags,
  UserCircle2,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { bookMallLoginHint } from "@/lib/book-mall-login-hint";
import { fetchFinanceViewer, type FinanceViewerPayload } from "@/lib/finance-viewer";
import { canViewFinanceCost, canCreateProposal, roleLabel } from "@/lib/permissions";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  prefix?: string;
  exact?: boolean;
  show?: (v: FinanceViewerPayload) => boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "start",
    label: "入门",
    items: [
      { href: "/admin", label: "概览", icon: LayoutDashboard, exact: true },
      { href: "/admin/help", label: "使用说明", icon: HelpCircle, prefix: "/admin/help" },
    ],
  },
  {
    id: "ledger",
    label: "账务明细",
    items: [
      {
        href: "/admin/billing/users",
        label: "用户明细",
        icon: UserCircle2,
        prefix: "/admin/billing/users",
        show: (v) => canViewFinanceCost(v.user.role),
      },
      {
        href: "/admin/billing/all",
        label: "费用明细（全部）",
        icon: ListChecks,
        prefix: "/admin/billing/all",
        show: (v) => canViewFinanceCost(v.user.role),
      },
      {
        href: "/admin/usage-overview",
        label: "费用概览",
        icon: FileSpreadsheet,
        prefix: "/admin/usage-overview",
        show: (v) => canViewFinanceCost(v.user.role),
      },
      {
        href: "/admin/pnl-alerts",
        label: "盈亏预警",
        icon: AlertTriangle,
        prefix: "/admin/pnl-alerts",
        show: (v) => canViewFinanceCost(v.user.role),
      },
      {
        href: "/admin/pnl-report",
        label: "P&L 报表",
        icon: Calculator,
        prefix: "/admin/pnl-report",
        show: (v) => canViewFinanceCost(v.user.role),
      },
      {
        href: "/admin/reconciliation",
        label: "云账单对账",
        icon: CloudUpload,
        prefix: "/admin/reconciliation",
        show: (v) => canViewFinanceCost(v.user.role),
      },
    ],
  },
  {
    id: "pricing",
    label: "定价与模型",
    items: [
      {
        href: "/admin/platform-models",
        label: "平台模型",
        icon: Layers,
        prefix: "/admin/platform-models",
        show: (v) => canViewFinanceCost(v.user.role),
      },
      {
        href: "/admin/model-cost",
        label: "模型成本",
        icon: Coins,
        prefix: "/admin/model-cost",
        show: (v) => canViewFinanceCost(v.user.role),
      },
      {
        href: "/admin/credit-pricing",
        label: "积分报价",
        icon: Calculator,
        prefix: "/admin/credit-pricing",
        show: (v) => canViewFinanceCost(v.user.role),
      },
      {
        href: "/admin/plan-change",
        label: "调价测算与审批",
        icon: GitPullRequest,
        prefix: "/admin/plan-change",
        show: (v) => canCreateProposal(v.user.role),
      },
      {
        href: "/admin/membership-plans",
        label: "会员套餐",
        icon: Users,
        prefix: "/admin/membership-plans",
        show: (v) => canViewFinanceCost(v.user.role),
      },
      {
        href: "/admin/byok",
        label: "BYOK 定价",
        icon: KeyRound,
        prefix: "/admin/byok",
        show: (v) => canViewFinanceCost(v.user.role),
      },
      { href: "/admin/pricing-disclosure", label: "价格公示", icon: Tags, prefix: "/admin/pricing-disclosure" },
    ],
  },
  {
    id: "analysis",
    label: "分析与风控",
    items: [
      {
        href: "/admin/test-cases",
        label: "财务测算",
        icon: ClipboardList,
        prefix: "/admin/test-cases",
        show: (v) => canViewFinanceCost(v.user.role),
      },
      {
        href: "/admin/scenario-lab",
        label: "Scenario Lab",
        icon: Beaker,
        prefix: "/admin/scenario-lab",
        show: (v) => canViewFinanceCost(v.user.role),
      },
      {
        href: "/admin/video-risk",
        label: "视频风控",
        icon: Wrench,
        prefix: "/admin/video-risk",
        show: (v) => canViewFinanceCost(v.user.role),
      },
    ],
  },
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = item.exact
    ? pathname === item.href
    : item.prefix
      ? pathname.startsWith(item.prefix)
      : pathname === item.href;
  return (
    <Link
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
}

export function AdminSidebar() {
  const pathname = usePathname();
  const base = useBookMallBaseUrl();
  const [viewer, setViewer] = useState<FinanceViewerPayload | null | undefined>(undefined);
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
    fetchFinanceViewer(base)
      .then((v) => {
        if (!cancelled) setViewer(v);
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
          </p>
        ) : (
          <>
            <p className="text-base font-semibold text-white">{viewer.user.name?.trim() || "—"}</p>
            <p className="mt-1 break-all text-sm text-white/80">{viewer.user.email?.trim() || "—"}</p>
            <p className="mt-2 text-sm text-white/75">角色：{roleLabel(viewer.user.role)}</p>
          </>
        )}
      </div>
      <nav className="flex-1 space-y-3 overflow-y-auto p-2">
        {NAV_GROUPS.map((group) => {
          const items = viewer
            ? group.items.filter((item) => !item.show || item.show(viewer))
            : group.items;
          if (items.length === 0) return null;
          return (
            <div key={group.id}>
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white/45">
                {group.label}
              </p>
              <div className="mt-0.5 space-y-0.5">
                {items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
