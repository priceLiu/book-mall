/**
 * 开发环境模拟会员套餐开通（MembershipPlan → CreditAccount）
 */
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { assertBillingPersona } from "@/lib/billing/billing-persona";
import { grantCredits } from "@/lib/billing/credit-account-service";
import { subscriptionCreditPeriodEnd } from "@/lib/billing/credit-lot-logic";
import {
  extendMembershipPaidUntil,
  membershipPaidUntilFromPurchase,
} from "@/lib/billing/membership-service-period";
import {
  resolvePlanCreditGrants,
  shouldDeferRenewalGrant,
} from "@/lib/billing/plan-credit-grants";
import { quoteTeamPlan } from "@/lib/billing/seat-billing-service";
import { TEAM_MIN_INCLUDED_SEATS } from "@/lib/billing/team-membership-config";
import { createTeamTenant } from "@/lib/tenant/tenant-service";
import { ensurePlatformManagedKeyForTenant } from "@/lib/gateway/platform-managed-key";
import { canTenant } from "@/lib/tenant/permission";

export async function applyMockMembershipSubscribe(input: {
  userId: string;
  planId: string;
  seats?: number;
  teamName?: string | null;
}) {
  await assertBillingPersona(input.userId, ["PLATFORM_CREDIT", "BYOK"]);

  const plan = await prisma.membershipPlan.findUnique({ where: { id: input.planId } });
  if (!plan || !plan.active) throw new Error("无效的会员套餐");

  const orderId = `mock_membership_${randomUUID()}`;
  const now = new Date();
  const creditPeriodEnd = subscriptionCreditPeriodEnd(now);

  if (plan.family === "TEAM") {
    const totalSeats = Math.max(
      TEAM_MIN_INCLUDED_SEATS,
      Math.round(input.seats ?? plan.includedSeats ?? TEAM_MIN_INCLUDED_SEATS),
    );
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
    let tenantPaidUntil: Date;
    let tenantPaidUntilBefore: Date | null = null;
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
      tenantPaidUntil = membershipPaidUntilFromPurchase(plan.interval, now);
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { currentPeriodEnd: tenantPaidUntil },
      });
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
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { currentPeriodEnd: true },
      });
      tenantPaidUntilBefore = tenant?.currentPeriodEnd ?? null;
      tenantPaidUntil = extendMembershipPaidUntil(tenant?.currentPeriodEnd, plan.interval, now);
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { currentPeriodEnd: tenantPaidUntil },
      });
    }

    const grants = resolvePlanCreditGrants(plan, quote.totalSeats, quote.perSeatCredits);
    const pricePerCreditYuan =
      quote.perSeatCredits > 0 ? quote.totalPriceYuan / quote.monthlyCreditsPool : null;
    const teamAcc = await prisma.creditAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "TENANT", ownerId: tenantId } },
      select: { planId: true, currentPeriodEnd: true },
    });
    const deferTeam = shouldDeferRenewalGrant({
      accountPlanId: teamAcc?.planId,
      planId: plan.id,
      paidUntilBefore: tenantPaidUntilBefore,
      creditPeriodEnd: teamAcc?.currentPeriodEnd,
      now,
    });
    if (deferTeam) {
      await prisma.creditAccount.update({
        where: { ownerType_ownerId: { ownerType: "TENANT", ownerId: tenantId } },
        data: { monthlyGrantCredits: grants.monthlyGrantCredits, pricePerCreditYuan },
      });
    } else {
      await grantCredits({
        ref: { ownerType: "TENANT", ownerId: tenantId },
        credits: grants.credits,
        monthlyGrantCredits: grants.monthlyGrantCredits,
        pricePerCreditYuan,
        planId: plan.id,
        currentPeriodEnd: creditPeriodEnd,
        idempotencyKey: orderId,
        description: `团队会员开通（${plan.tier} × ${quote.totalSeats} 席）`,
      });
    }

    return { orderId, planId: plan.id, tenantId, family: "TEAM" as const };
  }

  const grants = resolvePlanCreditGrants(plan, 1);
  const pricePerCreditYuan =
    Number(plan.monthlyCredits) > 0 ? Number(plan.priceYuan) / Number(plan.monthlyCredits) : null;
  const existingAcc = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: input.userId } },
    select: { membershipPaidUntil: true, planId: true, currentPeriodEnd: true },
  });
  const membershipPaidUntil = extendMembershipPaidUntil(
    existingAcc?.membershipPaidUntil,
    plan.interval,
    now,
  );
  const deferPersonal = shouldDeferRenewalGrant({
    accountPlanId: existingAcc?.planId,
    planId: plan.id,
    paidUntilBefore: existingAcc?.membershipPaidUntil,
    creditPeriodEnd: existingAcc?.currentPeriodEnd,
    now,
  });
  if (deferPersonal) {
    await prisma.creditAccount.update({
      where: { ownerType_ownerId: { ownerType: "USER", ownerId: input.userId } },
      data: {
        monthlyGrantCredits: grants.monthlyGrantCredits,
        pricePerCreditYuan,
        membershipPaidUntil,
      },
    });
  } else {
    await grantCredits({
      ref: { ownerType: "USER", ownerId: input.userId },
      credits: grants.credits,
      monthlyGrantCredits: grants.monthlyGrantCredits,
      pricePerCreditYuan,
      planId: plan.id,
      currentPeriodEnd: creditPeriodEnd,
      membershipPaidUntil,
      idempotencyKey: orderId,
      description: `个人会员开通（${plan.tier}）`,
    });
  }

  return { orderId, planId: plan.id, family: "PERSONAL" as const };
}
