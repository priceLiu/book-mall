import type { ByokSubscription, CreditOwnerType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  BYOK_SCOPE_PERSONAL,
  BYOK_SCOPE_TEAM_SEAT,
  BYOK_TEAM_MIN_SEATS,
} from "@/lib/billing/byok-pricing";
import type { AccountRef } from "@/lib/billing/credit-account-service";

export class ByokSubscriptionRequiredError extends Error {
  constructor(
    message = "须先开通 BYOK 套餐（报价页 → 自带 Key）；开通后绑定厂商 API Key 即可使用",
  ) {
    super(message);
    this.name = "ByokSubscriptionRequiredError";
  }
}

function addOneMonth(d: Date): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + 1);
  return out;
}

export async function getActiveByokSubscription(
  ref: AccountRef,
): Promise<ByokSubscription | null> {
  const now = new Date();
  return prisma.byokSubscription.findFirst({
    where: {
      ownerType: ref.ownerType,
      ownerId: ref.ownerId,
      status: "ACTIVE",
      periodEnd: { gt: now },
    },
    orderBy: { periodEnd: "desc" },
  });
}

export async function assertActiveByokSubscription(ref: AccountRef): Promise<ByokSubscription> {
  const sub = await getActiveByokSubscription(ref);
  if (!sub) throw new ByokSubscriptionRequiredError();
  return sub;
}

/** 个人有效 BYOK，或所在团队租户有有效 BYOK。 */
export async function userHasActiveByokAccess(userId: string): Promise<boolean> {
  const now = new Date();
  const personal = await prisma.byokSubscription.findFirst({
    where: {
      ownerType: "USER",
      ownerId: userId,
      status: "ACTIVE",
      periodEnd: { gt: now },
    },
  });
  if (personal) return true;

  const teamIds = (
    await prisma.tenantMember.findMany({
      where: { userId, status: "ACTIVE", tenant: { type: "TEAM", status: "ACTIVE" } },
      select: { tenantId: true },
    })
  ).map((m) => m.tenantId);

  if (teamIds.length === 0) return false;

  const teamSub = await prisma.byokSubscription.findFirst({
    where: {
      ownerType: "TENANT",
      ownerId: { in: teamIds },
      status: "ACTIVE",
      periodEnd: { gt: now },
    },
  });
  return Boolean(teamSub);
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
  const seats = Math.max(tenant?.seatLimit ?? 0, members, BYOK_TEAM_MIN_SEATS);
  return seats;
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

/**
 * 开通或续订 BYOK 套餐（模拟/正式支付成功后调用）。
 * 同一 owner 仅保留一条 ACTIVE，续订延长 periodEnd。
 */
export async function activateByokSubscription(input: {
  ownerType: CreditOwnerType;
  ownerId: string;
  scopeKey: string;
  seats?: number;
  orderId: string;
}): Promise<ActivateByokSubscriptionResult> {
  const cfg = await prisma.byokServiceConfig.findUnique({
    where: { scopeKey: input.scopeKey },
  });
  if (!cfg || !cfg.active) {
    throw new Error("BYOK 套餐未配置或已下线");
  }

  let seats = Math.max(1, Math.round(input.seats ?? 1));
  if (input.scopeKey === BYOK_SCOPE_TEAM_SEAT) {
    const min = cfg.minSeats ?? BYOK_TEAM_MIN_SEATS;
    seats = Math.max(min, seats);
  } else if (input.scopeKey !== BYOK_SCOPE_PERSONAL) {
    throw new Error("无效的 BYOK scopeKey");
  }

  const unitFee = Number(cfg.techServiceFeeYuan);
  const totalYuan =
    input.scopeKey === BYOK_SCOPE_TEAM_SEAT
      ? Math.round(unitFee * seats * 100) / 100
      : unitFee;

  const now = new Date();
  const existing = await prisma.byokSubscription.findFirst({
    where: {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      status: "ACTIVE",
    },
    orderBy: { periodEnd: "desc" },
  });

  const periodStart = existing && existing.periodEnd > now ? existing.periodStart : now;
  const baseEnd = existing && existing.periodEnd > now ? existing.periodEnd : now;
  const periodEnd = addOneMonth(baseEnd);

  const data = {
    scopeKey: input.scopeKey,
    status: "ACTIVE" as const,
    seats,
    techServiceFeeYuan: unitFee,
    periodStart,
    periodEnd,
    lastOrderId: input.orderId,
  };

  const sub = existing
    ? await prisma.byokSubscription.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.byokSubscription.create({
        data: {
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          ...data,
        },
      });

  if (existing) {
    await prisma.byokSubscription.updateMany({
      where: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        status: "ACTIVE",
        id: { not: sub.id },
      },
      data: { status: "EXPIRED" },
    });
  }

  return {
    subscriptionId: sub.id,
    scopeKey: input.scopeKey,
    seats,
    techServiceFeeYuan: unitFee,
    totalYuan,
    periodEnd,
    orderId: input.orderId,
  };
}
