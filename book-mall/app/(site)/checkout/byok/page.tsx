import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertBillingPersona } from "@/lib/billing/billing-persona";
import { BYOK_SCOPE_TEAM_SEAT } from "@/lib/billing/byok-pricing";
import { ByokCheckoutClient } from "@/components/checkout/byok-checkout-client";

export const dynamic = "force-dynamic";

export default async function CheckoutByokPage({
  searchParams,
}: {
  searchParams?: { scope?: string; tenantId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/checkout/byok");
  }

  try {
    await assertBillingPersona(session.user.id, "BYOK");
  } catch {
    redirect("/pricing?error=persona");
  }

  const scopeKey = searchParams?.scope?.trim() || "personal";
  const cfg = await prisma.byokServiceConfig.findUnique({ where: { scopeKey } });
  if (!cfg || !cfg.active) redirect("/pricing");

  const isTeamScope = scopeKey === BYOK_SCOPE_TEAM_SEAT;
  const teamTenants = isTeamScope
    ? (
        await prisma.tenantMember.findMany({
          where: {
            userId: session.user.id,
            status: "ACTIVE",
            role: { in: ["OWNER", "ADMIN"] },
            tenant: { type: "TEAM", status: "ACTIVE" },
          },
          include: { tenant: { select: { id: true, name: true } } },
        })
      ).map((m) => m.tenant)
    : [];

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <ByokCheckoutClient
        scopeKey={cfg.scopeKey}
        label={cfg.label}
        techServiceFeeYuan={Number(cfg.techServiceFeeYuan)}
        isTeamScope={isTeamScope}
        teamTenants={teamTenants}
        minSeats={cfg.minSeats}
      />
    </main>
  );
}
