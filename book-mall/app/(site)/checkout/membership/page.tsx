import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertBillingPersona, BillingPersonaError } from "@/lib/billing/billing-persona";
import { quoteTeamPlan } from "@/lib/billing/seat-billing-service";
import { TEAM_MIN_INCLUDED_SEATS } from "@/lib/billing/team-membership-config";
import {
  buildLoginRedirectForCheckout,
  buildMembershipCheckoutPath,
} from "@/lib/payments/checkout-login-redirect";
import { MembershipCheckoutClient } from "@/components/checkout/membership-checkout-client";

export const dynamic = "force-dynamic";

export default async function CheckoutMembershipPage({
  searchParams,
}: {
  searchParams?: { planId?: string; seats?: string };
}) {
  const session = await getServerSession(authOptions);
  const checkoutPath = buildMembershipCheckoutPath(searchParams ?? {});

  if (!session?.user?.id) {
    redirect(buildLoginRedirectForCheckout(checkoutPath));
  }

  const planId = searchParams?.planId?.trim();
  if (!planId) redirect("/pricing?error=no-plan");

  try {
    await assertBillingPersona(session.user.id, "PLATFORM_CREDIT");
  } catch (e) {
    if (e instanceof BillingPersonaError && e.code === "PERSONA_REQUIRED") {
      redirect(
        `/onboarding/billing-persona?next=${encodeURIComponent(checkoutPath)}`,
      );
    }
    redirect(
      `/pricing?error=${e instanceof BillingPersonaError && e.code === "PERSONA_MISMATCH" ? "byok-persona" : "persona"}`,
    );
  }

  const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.active) redirect("/pricing?error=invalid-plan");

  const isTeam = plan.family === "TEAM";
  const seats = Math.max(
    TEAM_MIN_INCLUDED_SEATS,
    Math.round(Number(searchParams?.seats) || plan.includedSeats || TEAM_MIN_INCLUDED_SEATS),
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
