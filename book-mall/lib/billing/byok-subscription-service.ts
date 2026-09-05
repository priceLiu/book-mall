import type { CreditOwnerType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isMembershipServiceActive } from "@/lib/billing/membership-service-period";
import {
  BYOK_SCOPE_PERSONAL,
  BYOK_SCOPE_TEAM_SEAT,
  BYOK_TEAM_MIN_SEATS,
} from "@/lib/billing/byok-pricing";
import type { AccountRef } from "@/lib/billing/credit-account-service";

/** BYOK 表已退役；保留类型供历史页面/API 编译，运行时恒为 null。 */
export type LegacyByokSubscription = {
  id: string;
  ownerType: CreditOwnerType;
  ownerId: string;
  scopeKey: string;
  status: "ACTIVE";
  seats: number;
  techServiceFeeYuan: number;
  periodStart: Date;
  periodEnd: Date;
  lastOrderId: string | null;
};

export class ByokSubscriptionRequiredError extends Error {
  constructor(
    message = "须先开通会员订阅（报价页）并关联 Gateway Key；超额编排从轻量包扣积分",
  ) {
    super(message);
    this.name = "ByokSubscriptionRequiredError";
  }
}

export async function getActiveByokSubscription(
  _ref: AccountRef,
): Promise<LegacyByokSubscription | null> {
  return null;
}

export async function assertActiveByokSubscription(
  ref: AccountRef,
): Promise<LegacyByokSubscription | null> {
  const now = new Date();
  if (ref.ownerType === "USER") {
    const acc = await prisma.creditAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "USER", ownerId: ref.ownerId } },
      select: { planId: true, membershipPaidUntil: true },
    });
    if (acc?.planId && isMembershipServiceActive(acc.membershipPaidUntil, now)) {
      return null;
    }
  } else {
    const tenant = await prisma.tenant.findUnique({
      where: { id: ref.ownerId },
      select: { planId: true, currentPeriodEnd: true, status: true, type: true },
    });
    if (
      tenant?.type === "TEAM" &&
      tenant.status === "ACTIVE" &&
      tenant.planId &&
      isMembershipServiceActive(tenant.currentPeriodEnd, now)
    ) {
      return null;
    }
  }

  throw new ByokSubscriptionRequiredError();
}

export async function userHasActiveByokAccess(_userId: string): Promise<boolean> {
  return false;
}

export async function resolveByokSeatsForTenant(tenantId: string): Promise<number> {
  const [tenant, members] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { seatLimit: true },
    }),
    prisma.tenantMember.count({
      where: { tenantId, status: "ACTIVE" },
    }),
  ]);
  return Math.max(tenant?.seatLimit ?? 0, members, BYOK_TEAM_MIN_SEATS);
}

export type ActivateByokSubscriptionResult = {
  subscriptionId: string;
  scopeKey: string;
  seats: number;
  techServiceFeeYuan: number;
  totalYuan: number;
  periodEnd: Date;
  orderId: string;
};

export async function activateByokSubscription(_input: {
  ownerType: CreditOwnerType;
  ownerId: string;
  scopeKey: string;
  seats?: number;
  orderId: string;
}): Promise<ActivateByokSubscriptionResult> {
  throw new Error("BYOK 套餐已退役，请开通会员订阅并使用 Gateway 平台代付");
}

export { BYOK_SCOPE_PERSONAL, BYOK_SCOPE_TEAM_SEAT };
