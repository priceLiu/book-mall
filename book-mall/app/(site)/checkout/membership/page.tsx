import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertBillingPersona } from "@/lib/billing/billing-persona";
import { quoteTeamPlan } from "@/lib/billing/seat-billing-service";
import { MembershipCheckoutClient } from "@/components/checkout/membership-checkout-client";

export const dynamic = "force-dynamic";

export default async function CheckoutMembershipPage({
  searchParams,
}: {
  searchParams?: { planId?: string; seats?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/checkout/membership?planId=${searchParams?.planId ?? ""}`);
  }

  const planId = searchParams?.planId?.trim();
  if (!planId) redirect("/pricing");

  try {
    await assertBillingPersona(session.user.id, "PLATFORM_CREDIT");
  } catch {
    redirect("/pricing?error=persona");
  }

  const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.active) redirect("/pricing");

  const isTeam = plan.family === "TEAM";
  const seats = Math.max(
    1,
    Math.round(Number(searchParams?.seats) || plan.includedSeats || 1),
  );

  let priceYuan = Number(plan.priceYuan);
  if (isTeam) {
    const quote = await quoteTeamPlan({ planId: plan.id, totalSeats: seats });
    priceYuan = quote.totalPriceYuan;
  }

  const interval = plan.interval === "YEAR" ? "年付" : "月付";
  const planLabel = `${isTeam ? "团队" : "个人"} · ${plan.tier}（${interval}）`;

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <MembershipCheckoutClient
        planId={plan.id}
        planLabel={planLabel}
        priceYuan={priceYuan}
        seats={isTeam ? seats : undefined}
        isTeam={isTeam}
      />
    </main>
  );
}
