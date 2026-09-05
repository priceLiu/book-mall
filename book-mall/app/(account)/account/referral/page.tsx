import { AccountSectionHeader } from "@/components/account/account-section-header";
import { ReferralPanelSection } from "@/components/account/referral-panel-section";

export const metadata = {
  title: "邀请明细 — 个人中心",
};

export default function AccountReferralPage() {
  return (
    <>
      <AccountSectionHeader
        title="邀请明细"
        description="邀请好友与工作流分享的积分奖励；下方为邀请记录与统计。"
      />
      <ReferralPanelSection />
    </>
  );
}
