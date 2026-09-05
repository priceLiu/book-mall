"use client";

import { useEffect, useState } from "react";

import { AccountOverviewCards } from "@/components/account/account-overview-cards";
import { AccountOverviewSkeleton } from "@/components/account/account-overview-skeleton";
import { CreditLotBreakdown } from "@/components/account/credit-lot-breakdown";
import type { AccountOverviewJson } from "@/lib/account/load-account-overview";
import type { CreditSource } from "@prisma/client";

type OverviewPayload = AccountOverviewJson & {
  referralEligibility?: {
    eligible: boolean;
    planLabel: string | null;
    reason: string | null;
    sharePersona?: "personal" | "team_owner" | null;
  };
};

type LoadState = "loading" | "ready" | "error";

export function AccountOverviewSection() {
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<OverviewPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/overview", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as OverviewPayload;
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
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
    return <AccountOverviewSkeleton />;
  }

  if (state === "error" || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        概览加载失败，请{" "}
        <button
          type="button"
          className="text-primary underline-offset-2 hover:underline"
          onClick={() => window.location.reload()}
        >
          刷新页面
        </button>
        重试。
      </p>
    );
  }

  const membershipPeriodEnd = data.membershipPeriodEnd
    ? new Date(data.membershipPeriodEnd)
    : null;
  const courseSubscriptionEndsAt = data.flags.subscriptionEndsAt
    ? new Date(data.flags.subscriptionEndsAt)
    : null;

  const lots = data.lotBreakdown.map((lot) => ({
    source: lot.source as CreditSource,
    remainingCredits: lot.remainingCredits,
    expiresAt: lot.expiresAt ? new Date(lot.expiresAt) : null,
  }));

  return (
    <>
      <AccountOverviewCards
        creditBalance={data.creditBalances.balance}
        creditReserved={data.creditBalances.reserved}
        billingPersona={data.billingPersona}
        membershipPlanName={data.memberAccess.planName}
        membershipPeriodEnd={membershipPeriodEnd}
        planPriceLabel={data.planPriceLabel}
        hasActiveMembership={data.memberAccess.ok}
        hasActiveCourseSubscription={
          data.flags.hasActiveCourseProductSubscription || data.flags.hasActiveSubscription
        }
        coursePlanName={data.flags.membershipPlanName}
        courseSubscriptionEndsAt={courseSubscriptionEndsAt}
        usageSummary={data.usageSummary}
        packageUsageRows={data.packageUsageRows}
        isTeamSharedPool={data.isTeamSharedPool}
        showReferralShare={data.referralEligibility?.eligible ?? false}
        sharePersona={
          data.referralEligibility?.sharePersona === "team_owner"
            ? "team_owner"
            : "personal"
        }
      />
      <CreditLotBreakdown lots={lots} />
    </>
  );
}
