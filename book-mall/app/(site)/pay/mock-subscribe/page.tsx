import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MockSubscribeCheckout } from "@/components/pay/mock-subscribe-checkout";
import type { MockSubscribePlanSlug } from "@/lib/apply-mock-subscription";

export const metadata = {
  title: "模拟收银 — 订阅 — AI Mall",
};

export default async function MockSubscribePayPage({
  searchParams,
}: {
  searchParams: { plan?: string };
}) {
  const raw =
    typeof searchParams.plan === "string"
      ? searchParams.plan.trim().toLowerCase()
      : "";
  const planSlug: MockSubscribePlanSlug =
    raw === "yearly" ? "yearly" : "monthly";

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/pay/mock-subscribe?plan=${planSlug}`)}`,
    );
  }

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { slug: planSlug },
  });
  if (!plan?.active) {
    redirect("/subscribe");
  }

  const intervalLabel = plan.interval === "YEAR" ? "年度" : "月度";

  return (
    <MockSubscribeCheckout
      planSlug={planSlug}
      planName={plan.name}
      amountPoints={plan.pricePoints}
      intervalLabel={intervalLabel}
    />
  );
}
