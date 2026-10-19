"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinanceBookMallUnreachableState } from "@/components/finance-book-mall-unreachable";
import { FinancePageState } from "@/components/finance-page-shell";
import { bookMallLoginHint } from "@/lib/book-mall-login-hint";
import {
  fetchFinanceViewerDetailed,
  type FinanceViewerPayload,
} from "@/lib/finance-viewer";
import {
  canCreateProposal,
  canManagePricing,
  canViewFinanceCost,
  isPlatformStaff,
} from "@/lib/permissions";

export type AdminGateRequirement = "viewCost" | "managePricing" | "staff" | "proposal";

function checkRequirement(v: FinanceViewerPayload, req: AdminGateRequirement): boolean {
  const role = v.user.role;
  switch (req) {
    case "viewCost":
      return v.permissions.canViewFinanceCost || canViewFinanceCost(role);
    case "managePricing":
      return v.permissions.canManagePricing || canManagePricing(role);
    case "staff":
      return v.permissions.isPlatformStaff || isPlatformStaff(role);
    case "proposal":
      return v.permissions.canCreateProposal || canCreateProposal(role);
    default:
      return false;
  }
}

const DENY_MSG: Record<AdminGateRequirement, string> = {
  viewCost: "此页面仅财务管理员（FINANCE / SUPER_ADMIN / ADMIN）可访问，运营账号无权查看模型成本等敏感数据。",
  managePricing: "此页面仅财务管理员可维护定价与套餐配置。",
  staff: "此页面仅平台工作人员可访问。",
  proposal: "此页面需运营及以上角色可访问。",
};

type GateState =
  | { phase: "loading" }
  | { phase: "no_base" }
  | { phase: "unreachable" }
  | { phase: "guest" }
  | { phase: "deny"; viewer: FinanceViewerPayload }
  | { phase: "ok"; viewer: FinanceViewerPayload };

export function FinanceAdminGate({
  require,
  children,
}: {
  require: AdminGateRequirement;
  children: ReactNode;
}) {
  const base = useBookMallBaseUrl();
  const [state, setState] = useState<GateState>({ phase: "loading" });

  useEffect(() => {
    if (!base) {
      setState({ phase: "no_base" });
      return;
    }
    let cancelled = false;
    setState({ phase: "loading" });
    fetchFinanceViewerDetailed(base).then((r) => {
      if (cancelled) return;
      if (r.status === "unreachable") {
        setState({ phase: "unreachable" });
        return;
      }
      if (r.status === "guest") {
        setState({ phase: "guest" });
        return;
      }
      const viewer = r.viewer;
      if (!checkRequirement(viewer, require)) {
        setState({ phase: "deny", viewer });
        return;
      }
      setState({ phase: "ok", viewer });
    });
    return () => {
      cancelled = true;
    };
  }, [base, require]);

  if (state.phase === "loading") {
    return <FinancePageState>校验权限中…</FinancePageState>;
  }
  if (state.phase === "unreachable" && base) {
    return <FinanceBookMallUnreachableState base={base} />;
  }
  if (state.phase === "no_base" || state.phase === "guest") {
    return (
      <FinancePageState variant="error">
        未登录或未配置主站地址。请先在{" "}
        {base ? (
          <a
            href={bookMallLoginHint(base, "admin").loginUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[#1890ff] underline"
          >
            主站登录
          </a>
        ) : (
          "主站"
        )}{" "}
        后刷新。
      </FinancePageState>
    );
  }
  if (state.phase === "deny") {
    return (
      <FinancePageState>
        <div className="mx-auto max-w-lg">
          <div className="rounded border border-[#ffccc7] bg-[#fff1f0] px-4 py-3 text-sm text-[#cf1322]">
            <p className="font-medium">无权访问</p>
            <p className="mt-1">{DENY_MSG[require]}</p>
            <p className="mt-2 text-[#8c8c8c]">当前角色：{state.viewer.user.role}</p>
          </div>
        </div>
      </FinancePageState>
    );
  }
  return <>{children}</>;
}
