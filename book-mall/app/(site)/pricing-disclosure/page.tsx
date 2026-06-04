import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isPricingFromAccount } from "@/lib/pricing-disclosure-view";
import { PricingDisclosureContent } from "@/components/pricing/pricing-disclosure-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata = {
  title: "价格公示与使用说明",
  description:
    "订阅价格、工具按次单价（点数）、最低余额线等运营公示，附典型扣费场景说明。",
};

/**
 * 价格公示页（公开访问；营销顶栏等仍走本站布局）。
 * 个人中心请使用 `/account/pricing`（内嵌同一内容，不离开账户壳）。
 */
export default async function PricingDisclosurePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const sp = await searchParams;
  if (isPricingFromAccount(sp)) {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      redirect("/account/pricing");
    }
  }

  const fromAccount = isPricingFromAccount(sp);
  return <PricingDisclosureContent fromAccount={fromAccount} />;
}
