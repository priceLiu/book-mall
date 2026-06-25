"use client";

import { useState } from "react";
import { Check, Copy, Gift } from "lucide-react";

import type { ReferralDashboard } from "@/lib/referral/referral-service";

function yuan(n: number): string {
  return `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(dashboard.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 剪贴板不可用时忽略，用户可手动复制 */
    }
  }

  const ratePct =
    dashboard.commissionRate > 0
      ? `${(dashboard.commissionRate * 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}%`
      : "未设置";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#d0d7de] bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-[#1f2328]">
          <Gift className="size-5 text-[#8957e5]" />
          <h3 className="text-base font-semibold">我的专属分享链接</h3>
        </div>
        <p className="mb-3 text-sm text-[#656d76]">
          {planLabel ? `当前套餐：${planLabel}。` : null}
          将链接发给好友，对方通过链接注册后即与你关联；好友的套餐与充值消费将计入你的推广业绩。
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={dashboard.shareUrl}
            className="min-w-0 flex-1 rounded-lg border border-[#d0d7de] bg-[#f6f8fa] px-3 py-2 text-sm text-[#1f2328]"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#8957e5] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7c4fd6]"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "已复制" : "复制链接"}
          </button>
        </div>
        {!dashboard.enabled ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            该分享链接已被管理员停用，新注册将不再计入推广业绩。如有疑问请联系平台。
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="邀请注册" value={`${dashboard.referredCount} 人`} />
        <StatCard label="套餐消费" value={yuan(dashboard.totalPlanAmountYuan)} />
        <StatCard label="充值消费" value={yuan(dashboard.totalRechargeAmountYuan)} />
        <StatCard
          label="返佣比例"
          value={ratePct}
          hint={
            dashboard.commissionRate > 0
              ? `预估返佣 ${yuan(dashboard.estimatedCommissionYuan)}`
              : "由平台财务核定"
          }
        />
      </div>

      <div className="rounded-xl border border-[#d0d7de] bg-white">
        <div className="border-b border-[#d0d7de] px-5 py-3">
          <h3 className="text-base font-semibold text-[#1f2328]">邀请明细</h3>
        </div>
        {dashboard.rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#656d76]">
            还没有好友通过你的链接注册，快去分享吧～
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-[#d0d7de] text-left text-xs text-[#656d76]">
                  <th className="px-5 py-2 font-medium">用户</th>
                  <th className="px-5 py-2 font-medium">手机号</th>
                  <th className="px-5 py-2 font-medium">注册时间</th>
                  <th className="px-5 py-2 text-right font-medium">套餐消费</th>
                  <th className="px-5 py-2 text-right font-medium">充值消费</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.rows.map((r) => (
                  <tr
                    key={r.userId}
                    className="border-b border-[#eaeef2] last:border-0 text-[#1f2328]"
                  >
                    <td className="px-5 py-3">{r.name || "未设置昵称"}</td>
                    <td className="px-5 py-3 text-[#656d76]">{r.phoneMasked}</td>
                    <td className="px-5 py-3 text-[#656d76]">
                      {formatDate(r.joinedAt)}
                    </td>
                    <td className="px-5 py-3 text-right">{yuan(r.planAmountYuan)}</td>
                    <td className="px-5 py-3 text-right">
                      {yuan(r.rechargeAmountYuan)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-[#656d76]">
        说明：返佣比例由平台财务统一核定后录入；金额按好友「套餐消费 + 充值消费」实付汇总。数据为实时统计，最终结算以平台为准。
      </p>
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
      {hint ? <p className="mt-1 text-xs text-[#8957e5]">{hint}</p> : null}
    </div>
  );
}
