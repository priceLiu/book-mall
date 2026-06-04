import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { PricingDisclosureContent } from "@/components/pricing/pricing-disclosure-content";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "价目与公示 — 个人中心",
  description: "订阅价格、工具按次单价与计费说明。",
};

export default async function AccountPricingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?next=/account/pricing");
  }

  return (
    <>
      <AccountSectionHeader
        title="价目与公示"
        description="订阅价、按次工具单价与余额线说明；与前台公示数据同源。"
      />
      <PricingDisclosureContent fromAccount embedded />
    </>
  );
}
