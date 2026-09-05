"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ReferralPanel } from "@/components/account/referral-panel";
import { ReferralPanelSkeleton } from "@/components/account/referral-panel-skeleton";
import type { ReferralDashboardJson } from "@/lib/account/referral-dashboard-json";
import type { ReferralDashboard } from "@/lib/referral/referral-service";

type LoadState = "loading" | "ready" | "error";

type ReferralDashboardResponse = {
  ok: boolean;
  eligible: boolean;
  reason?: string | null;
  dashboard?: ReferralDashboardJson;
};

function toReferralDashboard(json: ReferralDashboardJson): ReferralDashboard {
  return {
    ...json,
    rows: json.rows.map((row) => ({
      ...row,
      joinedAt: new Date(row.joinedAt),
    })),
  };
}

export function ReferralPanelSection() {
  const [state, setState] = useState<LoadState>("loading");
  const [payload, setPayload] = useState<ReferralDashboardResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/referral/dashboard", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as ReferralDashboardResponse;
      })
      .then((data) => {
        if (!cancelled) {
          setPayload(data);
          setState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return <ReferralPanelSkeleton />;
  }

  if (state === "error" || !payload) {
    return (
      <p className="text-sm text-muted-foreground">
        加载失败，请{" "}
        <button
          type="button"
          className="text-primary underline-offset-2 hover:underline"
          onClick={() => window.location.reload()}
        >
          刷新
        </button>
        重试。
      </p>
    );
  }

  if (!payload.eligible) {
    return (
      <div className="rounded-xl border border-[#d0d7de] bg-white p-6">
        <p className="text-sm text-[#1f2328]">
          分享面向有效个人订阅或团队主账号；团队 ADMIN/MEMBER 不可分享（即便另有个人订阅）。
        </p>
        <p className="mt-2 text-sm text-[#656d76]">
          {payload.reason ?? "当前账号暂不支持分享。"}
          {payload.reason === "团队成员不可分享"
            ? "如需分享请使用个人订阅账号，或由团队 OWNER 主账号操作。"
            : "订阅任意套餐后即可生成专属邀请码。"}
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-flex items-center rounded-lg bg-[#8957e5] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7c4fd6]"
        >
          查看会员套餐
        </Link>
      </div>
    );
  }

  if (!payload.dashboard) {
    return (
      <p className="text-sm text-red-600" role="alert">
        分享数据为空，请稍后重试。
      </p>
    );
  }

  return (
    <ReferralPanel
      dashboard={toReferralDashboard(payload.dashboard)}
      planLabel={payload.dashboard.planLabel}
    />
  );
}
