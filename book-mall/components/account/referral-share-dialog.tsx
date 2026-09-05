"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gift, Loader2, X } from "lucide-react";

import { ShareGuideDialog } from "@/components/pricing/share-guide-dialog";
import { ShareCodeBundle } from "@/components/share/share-code-bundle";
import { Button } from "@/components/ui/button";
import type { ReferralDashboardJson } from "@/lib/account/referral-dashboard-json";
import type { ReferralSharePersona } from "@/lib/referral/referral-share-persona";

type LoadState = "idle" | "loading" | "ready" | "error";

export function ReferralShareDialog({
  open,
  onClose,
  sharePersona = "personal",
}: {
  open: boolean;
  onClose: () => void;
  sharePersona?: ReferralSharePersona;
}) {
  const [state, setState] = useState<LoadState>("idle");
  const [dashboard, setDashboard] = useState<ReferralDashboardJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setState("idle");
      setDashboard(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setState("loading");
    setError(null);

    fetch("/api/account/referral/dashboard", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as {
          ok?: boolean;
          eligible?: boolean;
          dashboard?: ReferralDashboardJson;
          reason?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? "加载失败");
        if (!body.eligible) {
          throw new Error(body.reason ?? "不满足分享门禁");
        }
        if (!body.dashboard) throw new Error("分享数据为空");
        return body.dashboard;
      })
      .then((data) => {
        if (!cancelled) {
          setDashboard(data);
          setState("ready");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const isTeamOwner = sharePersona === "team_owner";
  const title = isTeamOwner ? "分享邀请" : "分享得积分";
  const subtitle = isTeamOwner
    ? "8 位邀请码面向团队外好友：注册并首笔付费后你得积分。画布等工作流分享用于邀请成员加入团队，不发分享积分。"
    : `复制邀请码或扫码分享；好友首笔订阅/充值后你获 ${dashboard?.referralRewardCredits ?? 20} 积分，工作流分享最高 ${dashboard?.workflowShareRewardCredits ?? 40} 积分。`;

  const qrUrl = dashboard
    ? `/api/platform/share-code/qr?code=${encodeURIComponent(dashboard.code)}`
    : "";

  return (
    <>
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="referral-share-dialog-title"
        onClick={onClose}
      >
        <div
          className="flex max-h-[85vh] w-[clamp(320px,36vw,640px)] max-w-[min(92vw,640px)] flex-col overflow-hidden rounded-2xl border border-violet-200/80 bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-violet-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <h2
                id="referral-share-dialog-title"
                className="flex items-center gap-2 text-left text-lg font-semibold text-[#1f2328]"
              >
                <Gift className="size-5 shrink-0 text-violet-600" />
                {title}
              </h2>
              <button
                type="button"
                className="shrink-0 rounded-md p-1 text-[#656d76] hover:bg-[#f6f8fa]"
                aria-label="关闭"
                onClick={onClose}
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-1 text-left text-xs text-[#656d76]">{subtitle}</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-left">
            {state === "loading" ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-violet-600" aria-hidden />
                <p>正在加载你的分享码…</p>
              </div>
            ) : null}

            {state === "error" ? (
              <p className="py-8 text-center text-sm text-red-600" role="alert">
                {error ?? "加载失败"}
              </p>
            ) : null}

            {state === "ready" && dashboard ? (
              <div className="space-y-4">
                {dashboard.planLabel ? (
                  <p className="text-xs text-[#656d76]">当前套餐：{dashboard.planLabel}</p>
                ) : null}
                <ShareCodeBundle
                  code={dashboard.code}
                  shareUrl={dashboard.shareCodeUrl}
                  qrUrl={qrUrl}
                  legacyUrl={dashboard.legacyShareUrl}
                  codeLabel="8 位邀请码"
                />
                {!dashboard.enabled ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    该分享码已被管理员停用。
                  </p>
                ) : null}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <StatPill label="邀请注册" value={`${dashboard.referredCount} 人`} />
                  <StatPill
                    label="已获积分"
                    value={dashboard.creditsGranted.toLocaleString("zh-CN")}
                  />
                  <StatPill label="待完成" value={`${dashboard.pendingRewardCount} 人`} />
                </div>
                <button
                  type="button"
                  className="text-xs text-violet-700 underline-offset-2 hover:underline"
                  onClick={() => setGuideOpen(true)}
                >
                  分享与领取说明
                </button>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 flex flex-col gap-2 border-t border-violet-100 px-5 py-4 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              关闭
            </Button>
            <Button
              type="button"
              className="flex-1 bg-violet-600 hover:bg-violet-700"
              asChild
            >
              <Link href="/account/referral" onClick={onClose}>
                查看邀请明细
              </Link>
            </Button>
          </div>
        </div>
      </div>
      {guideOpen ? <ShareGuideDialog onClose={() => setGuideOpen(false)} /> : null}
    </>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-2 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
