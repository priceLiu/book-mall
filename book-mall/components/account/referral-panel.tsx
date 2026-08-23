"use client";

import { useState } from "react";
import { Gift } from "lucide-react";

import { ShareGuideDialog } from "@/components/pricing/share-guide-dialog";
import { ShareCodeBundle } from "@/components/share/share-code-bundle";
import type { ReferralDashboard } from "@/lib/referral/referral-service";

function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function ReferralPanel({
  dashboard,
  planLabel,
}: {
  dashboard: ReferralDashboard;
  planLabel: string | null;
}) {
  const [guideOpen, setGuideOpen] = useState(false);
  const qrUrl = `/api/platform/share-code/qr?code=${encodeURIComponent(dashboard.code)}`;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#d0d7de] bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-[#1f2328]">
          <Gift className="size-5 text-[#8957e5]" />
          <h3 className="text-base font-semibold">我的专属邀请码</h3>
        </div>
        <p className="mb-4 text-sm text-[#656d76]">
          {planLabel ? `当前套餐：${planLabel}。` : null}
          好友使用邀请码或扫码注册，并在<strong>首次订阅或充值</strong>后，你将获得{" "}
          <strong>{dashboard.referralRewardCredits} 积分</strong>（每人一次）。
          在画布/电商/快速复刻中分享工作流，好友<strong>首次成功生成并首笔付费</strong>后，你可获{" "}
          <strong>{dashboard.workflowShareRewardCredits} 积分</strong>。
        </p>
        <ShareCodeBundle
          code={dashboard.code}
          shareUrl={dashboard.shareCodeUrl}
          qrUrl={qrUrl}
          legacyUrl={dashboard.legacyShareUrl}
          codeLabel="8 位邀请码"
        />
        {!dashboard.enabled ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            该分享码已被管理员停用。如有疑问请联系平台。
          </p>
        ) : null}
        <button
          type="button"
          className="mt-4 text-xs text-[#8957e5] underline-offset-2 hover:underline"
          onClick={() => setGuideOpen(true)}
        >
          分享与领取说明
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="邀请注册" value={`${dashboard.referredCount} 人`} />
        <StatCard
          label="已获积分"
          value={`${dashboard.creditsGranted.toLocaleString()} 分`}
        />
        <StatCard
          label="待完成"
          value={`${dashboard.pendingRewardCount} 人`}
          hint="已关联，尚未满足发奖条件"
        />
        <StatCard
          label="邀请奖励"
          value={`${dashboard.referralRewardCredits} 分/人`}
          hint={`工作流 ${dashboard.workflowShareRewardCredits} 分/人`}
        />
      </div>

      <div className="rounded-xl border border-[#d0d7de] bg-white">
        <div className="border-b border-[#d0d7de] px-5 py-3">
          <h3 className="text-base font-semibold text-[#1f2328]">邀请明细</h3>
        </div>
        {dashboard.rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#656d76]">
            还没有好友通过你的邀请码注册，快去分享吧～
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#d0d7de] bg-[#f6f8fa] text-xs text-[#656d76]">
                  <th className="px-5 py-2 font-medium">用户</th>
                  <th className="px-5 py-2 font-medium">注册时间</th>
                  <th className="px-5 py-2 font-medium">套餐消费</th>
                  <th className="px-5 py-2 font-medium">充值消费</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.rows.map((row) => (
                  <tr key={row.userId} className="border-b border-[#eaeef2]">
                    <td className="px-5 py-3 text-[#1f2328]">
                      {row.name || row.phoneMasked || "用户"}
                    </td>
                    <td className="px-5 py-3 text-[#656d76]">{formatDate(row.joinedAt)}</td>
                    <td className="px-5 py-3 text-[#656d76]">¥{row.planAmountYuan.toFixed(2)}</td>
                    <td className="px-5 py-3 text-[#656d76]">
                      ¥{row.rechargeAmountYuan.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {guideOpen ? <ShareGuideDialog onClose={() => setGuideOpen(false)} /> : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[#d0d7de] bg-white p-4">
      <p className="text-xs text-[#656d76]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#1f2328]">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-[#656d76]">{hint}</p> : null}
    </div>
  );
}
