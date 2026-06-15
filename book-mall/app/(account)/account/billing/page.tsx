import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { loadPricingConfig } from "@/lib/pricing/credit-pricing-engine";
import { listUserTenantMemberships } from "@/lib/tenant/context";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { CreditTopupSection } from "@/components/pricing/credit-topup-section";

export const metadata = {
  title: "轻量包购买 — 个人中心",
};

export default async function AccountBillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [config, teamTenants] = await Promise.all([
    loadPricingConfig(),
    listUserTenantMemberships(session.user.id).then((ms) =>
      ms
        .filter((m) => m.tenantType === "TEAM")
        .map((m) => ({ id: m.tenantId, name: m.tenantName })),
    ),
  ]);

  return (
    <>
      <AccountSectionHeader
        title="轻量包购买"
        description="套餐积分用完后可在此加购，档位与价格页一致。会员套餐请前往报价页选购。"
      />

      <CreditTopupSection
        anchorYuan={config.creditAnchorYuan}
        isTeam={false}
        teamTenants={teamTenants}
        isLoggedIn
      />
    </>
  );
}
