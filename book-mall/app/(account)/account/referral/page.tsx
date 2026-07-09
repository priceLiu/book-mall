import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";

import { authOptions } from "@/lib/auth";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { ReferralPanel } from "@/components/account/referral-panel";
import {
  ensureReferralProfile,
  getReferralDashboard,
  getReferralEligibility,
} from "@/lib/referral/referral-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "分享返佣 — 个人中心",
};

function resolveShareBaseUrl(): string {
  const env = process.env.NEXTAUTH_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  if (!host) return "";
  const proto =
    h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function AccountReferralPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const eligibility = await getReferralEligibility(session.user.id);

  if (!eligibility.eligible) {
    return (
      <>
        <AccountSectionHeader
          title="分享返佣"
          description="邀请好友注册，好友的套餐与充值消费计入你的推广业绩，按平台核定比例返佣。"
        />
        <div className="rounded-xl border border-[#d0d7de] bg-white p-6">
          <p className="text-sm text-[#1f2328]">
            分享返佣面向任意有效订阅（个人套餐或团队主账号）开放；团队下的普通成员不可生成分享链接。
          </p>
          <p className="mt-2 text-sm text-[#656d76]">
            {eligibility.reason ?? "当前账号暂不支持分享返佣。"}
            {eligibility.reason === "团队成员不可分享"
              ? "如需分享请使用你自己的个人订阅账号。"
              : "订阅任意套餐后即可生成专属分享链接。"}
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex items-center rounded-lg bg-[#8957e5] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7c4fd6]"
          >
            查看会员套餐
          </Link>
        </div>
      </>
    );
  }

  const ensured = await ensureReferralProfile(session.user.id);
  if (!ensured.ok) {
    return (
      <>
        <AccountSectionHeader title="分享返佣" />
        <div className="rounded-xl border border-[#d0d7de] bg-white p-6">
          <p className="text-sm text-red-600">生成分享链接失败：{ensured.reason}</p>
        </div>
      </>
    );
  }

  const dashboard = await getReferralDashboard(
    session.user.id,
    resolveShareBaseUrl(),
  );
  if (!dashboard) {
    return (
      <>
        <AccountSectionHeader title="分享返佣" />
        <div className="rounded-xl border border-[#d0d7de] bg-white p-6">
          <p className="text-sm text-red-600">加载分享数据失败，请稍后重试。</p>
        </div>
      </>
    );
  }

  return (
    <>
      <AccountSectionHeader
        title="分享返佣"
        description="邀请好友注册，好友的套餐与充值消费计入你的推广业绩，按平台核定比例返佣。"
      />
      <ReferralPanel dashboard={dashboard} planLabel={eligibility.planLabel} />
    </>
  );
}
