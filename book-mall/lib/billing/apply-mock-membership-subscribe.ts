/**
 * 开发环境模拟会员套餐开通（MembershipPlan → CreditAccount）
 */
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { assertBillingPersona } from "@/lib/billing/billing-persona";
import { grantCredits } from "@/lib/billing/credit-account-service";
import { resolvePlanCreditGrants } from "@/lib/billing/plan-credit-grants";
import { quoteTeamPlan } from "@/lib/billing/seat-billing-service";
import { createTeamTenant } from "@/lib/tenant/tenant-service";
import { ensurePlatformManagedKeyForTenant } from "@/lib/gateway/platform-managed-key";
import { canTenant } from "@/lib/tenant/permission";

export async function applyMockMembershipSubscribe(input: {
  userId: string;
  planId: string;
  seats?: number;
  teamName?: string | null;
}) {
  await assertBillingPersona(input.userId, "PLATFORM_CREDIT");

  const plan = await prisma.membershipPlan.findUnique({ where: { id: input.planId } });
  if (!plan || !plan.active) throw new Error("无效的会员套餐");

  const orderId = `mock_membership_${randomUUID()}`;
  const periodEnd = new Date();
  if (plan.interval === "YEAR") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  if (plan.family === "TEAM") {
    const totalSeats = Math.max(1, Math.round(input.seats ?? plan.includedSeats ?? 1));
    const quote = await quoteTeamPlan({ planId: plan.id, totalSeats });
    const name = input.teamName?.trim() || `团队 ${new Date().toISOString().slice(0, 10)}`;

    const existingTeam = await prisma.tenantMember.findFirst({
      where: {
        userId: input.userId,
        status: "ACTIVE",
        role: "OWNER",
        tenant: { type: "TEAM", status: "ACTIVE", planId: plan.id },
      },
      select: { tenantId: true },
    });

    let tenantId = existingTeam?.tenantId;
    if (!tenantId) {
      const tenant = await createTeamTenant({
        ownerUserId: input.userId,
        name,
        planId: plan.id,
        packageLevel: plan.tier,
        interval: plan.interval,
        seatLimit: quote.totalSeats,
        perSeatCapCredits: null,
      });
      tenantId = tenant.id;
      try {
        await ensurePlatformManagedKeyForTenant(tenantId);
      } catch {
        /* non-fatal in mock */
      }
    } else {
      const member = await prisma.tenantMember.findFirst({
        where: { userId: input.userId, tenantId, status: "ACTIVE" },
      });
      if (!member || !canTenant(member.role, "billing:manage")) {
        throw new Error("仅团队主账号可续订团队套餐");
      }
    }

    const grants = resolvePlanCreditGrants(plan, quote.totalSeats);
    await grantCredits({
      ref: { ownerType: "TENANT", ownerId: tenantId },
      credits: grants.generalCredits,
      videoCredits: grants.videoCredits,
      monthlyGrantCredits: grants.monthlyGrantCredits,
      videoMonthlyGrantCredits: grants.videoMonthlyGrantCredits,
      pricePerCreditYuan:
        quote.perSeatCredits > 0 ? quote.totalPriceYuan / quote.monthlyCreditsPool : null,
      planId: plan.id,
      currentPeriodEnd: periodEnd,
      idempotencyKey: orderId,
      description: `团队会员开通（${plan.tier} × ${quote.totalSeats} 席）`,
    });

    return { orderId, planId: plan.id, tenantId, family: "TEAM" as const };
  }

  const grants = resolvePlanCreditGrants(plan, 1);
  await grantCredits({
    ref: { ownerType: "USER", ownerId: input.userId },
    credits: grants.generalCredits,
    videoCredits: grants.videoCredits,
    monthlyGrantCredits: grants.monthlyGrantCredits,
    videoMonthlyGrantCredits: grants.videoMonthlyGrantCredits,
    pricePerCreditYuan:
      plan.monthlyCredits > 0 ? Number(plan.priceYuan) / plan.monthlyCredits : null,
    planId: plan.id,
    currentPeriodEnd: periodEnd,
    idempotencyKey: orderId,
    description: `个人会员开通（${plan.tier}）`,
  });

  return { orderId, planId: plan.id, family: "PERSONAL" as const };
}
