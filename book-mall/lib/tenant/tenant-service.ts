/**
 * 租户/团队服务（gateway-multi-credential-and-tenant · 轨道 B）
 *
 * 负责：团队创建、成员/席位管理、角色变更、所有权转移、配置更新。
 * 计费走 CreditAccount(ownerType=TENANT, ownerId=tenantId)，由 seat-billing-service 报价 + grantCredits 发放。
 */
import type { Prisma, TenantRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ensureCreditAccount } from "@/lib/billing/credit-account-service";
import {
  handleMemberDeparture,
  type DepartureDisposition,
} from "./asset-sharing-service";

export interface CreateTeamInput {
  ownerUserId: string;
  name: string;
  planId?: string | null;
  packageLevel?: string | null;
  interval?: "MONTH" | "YEAR" | null;
  seatLimit: number;
  perSeatCapCredits?: number | null;
  maxConcurrency?: number;
}

/** 创建团队租户：建租户 + 席位 + OWNER 成员 + TENANT 积分账户。 */
export async function createTeamTenant(input: CreateTeamInput) {
  const seatLimit = Math.max(1, Math.round(input.seatLimit));
  const tenant = await prisma.$transaction(async (tx) => {
    const t = await tx.tenant.create({
      data: {
        type: "TEAM",
        name: input.name.trim() || "我的团队",
        ownerUserId: input.ownerUserId,
        planId: input.planId ?? null,
        packageLevel: input.packageLevel ?? null,
        interval: input.interval ?? null,
        seatLimit,
        perSeatCapCredits: input.perSeatCapCredits ?? null,
        maxConcurrency: input.maxConcurrency ?? 2,
        status: "ACTIVE",
      },
    });
    // 建满席位
    const seats = await Promise.all(
      Array.from({ length: seatLimit }).map((_, i) =>
        tx.seat.create({
          data: {
            tenantId: t.id,
            status: i === 0 ? "ACTIVE" : "IDLE",
            label: i === 0 ? "主账号席位" : `席位 ${i + 1}`,
          },
        }),
      ),
    );
    // OWNER 成员占首席
    await tx.tenantMember.create({
      data: {
        tenantId: t.id,
        userId: input.ownerUserId,
        role: "OWNER",
        status: "ACTIVE",
        seatId: seats[0].id,
      },
    });
    return t;
  });

  await ensureCreditAccount(
    { ownerType: "TENANT", ownerId: tenant.id },
    input.planId ?? null,
  );
  return tenant;
}

export async function getTenant(tenantId: string) {
  return prisma.tenant.findUnique({ where: { id: tenantId } });
}

/** 团队概览（含成员、席位占用）。 */
export async function getTenantOverview(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      members: {
        where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          seat: { select: { id: true, label: true, status: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
      seats: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!tenant) return null;
  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "TENANT", ownerId: tenantId } },
    select: {
      balanceCredits: true,
      monthlyGrantCredits: true,
      perSeatCapCredits: true,
      currentPeriodEnd: true,
    },
  });
  const usedSeats = tenant.members.filter((m) => m.seatId).length;
  return {
    tenant,
    members: tenant.members,
    seats: tenant.seats,
    usedSeats,
    seatLimit: tenant.seatLimit,
    account,
  };
}

/** 当前用户在租户内的成员记录（含角色），用于权限校验。 */
export async function getMembership(tenantId: string, userId: string) {
  return prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
}

/** 占用一个空闲席位；无空闲则返回 null（需先扩容）。 */
async function occupyIdleSeat(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<string | null> {
  const seat = await tx.seat.findFirst({
    where: { tenantId, status: "IDLE" },
    orderBy: { createdAt: "asc" },
  });
  if (!seat) return null;
  await tx.seat.update({ where: { id: seat.id }, data: { status: "ACTIVE" } });
  return seat.id;
}

export class SeatUnavailableError extends Error {
  constructor() {
    super("没有空闲席位，请先扩容席位数");
    this.name = "SeatUnavailableError";
  }
}

/** 调整角色（不能把唯一 OWNER 降级）。 */
export async function updateMemberRole(input: {
  tenantId: string;
  memberId: string;
  role: TenantRole;
}) {
  const member = await prisma.tenantMember.findUnique({
    where: { id: input.memberId },
  });
  if (!member || member.tenantId !== input.tenantId) {
    throw new Error("成员不存在");
  }
  if (member.role === "OWNER" && input.role !== "OWNER") {
    const owners = await prisma.tenantMember.count({
      where: { tenantId: input.tenantId, role: "OWNER", status: "ACTIVE" },
    });
    if (owners <= 1) throw new Error("不能降级唯一的所有者，请先转移所有权");
  }
  return prisma.tenantMember.update({
    where: { id: input.memberId },
    data: { role: input.role },
  });
}

/**
 * 移除成员：释放席位、状态置 REMOVED。OWNER 不可被移除。
 * 离队私有资产处置（disposition）：
 *  - TRANSFER_PUBLIC（默认）：转团队公共库；
 *  - REASSIGN：移交给租户 OWNER；
 *  - DELETE：删除记录（返回 OSS 链接，云端清理由调用方在二次确认后执行）。
 */
export async function removeMember(input: {
  tenantId: string;
  memberId: string;
  assetDisposition?: DepartureDisposition;
}) {
  const member = await prisma.tenantMember.findUnique({
    where: { id: input.memberId },
  });
  if (!member || member.tenantId !== input.tenantId) {
    throw new Error("成员不存在");
  }
  if (member.role === "OWNER") throw new Error("不能移除所有者");

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { ownerUserId: true },
  });

  const disposition: DepartureDisposition = input.assetDisposition ?? "TRANSFER_PUBLIC";
  const departure = await handleMemberDeparture({
    tenantId: input.tenantId,
    departingUserId: member.userId,
    disposition,
    reassignToUserId: disposition === "REASSIGN" ? tenant?.ownerUserId ?? null : null,
  });

  const result = await prisma.$transaction(async (tx) => {
    if (member.seatId) {
      await tx.seat.update({
        where: { id: member.seatId },
        data: { status: "IDLE" },
      });
    }
    return tx.tenantMember.update({
      where: { id: input.memberId },
      data: { status: "REMOVED", seatId: null },
    });
  });

  const ossUrls = departure.flatMap((r) => r.ossUrls);
  return { member: result, departure, ossUrls };
}

/** 转移所有权：原 OWNER → ADMIN，目标成员 → OWNER，并更新 tenant.ownerUserId。 */
export async function transferOwnership(input: {
  tenantId: string;
  fromUserId: string;
  toMemberId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.tenantMember.findUnique({
      where: { id: input.toMemberId },
    });
    if (!target || target.tenantId !== input.tenantId || target.status !== "ACTIVE") {
      throw new Error("目标成员无效");
    }
    await tx.tenantMember.updateMany({
      where: { tenantId: input.tenantId, userId: input.fromUserId, role: "OWNER" },
      data: { role: "ADMIN" },
    });
    await tx.tenantMember.update({
      where: { id: input.toMemberId },
      data: { role: "OWNER" },
    });
    await tx.tenant.update({
      where: { id: input.tenantId },
      data: { ownerUserId: target.userId },
    });
  });
}

/** 更新团队配置（名称/并发/人均上限/席位上限）。扩容时补建空闲席位。 */
export async function updateTenantConfig(input: {
  tenantId: string;
  name?: string;
  maxConcurrency?: number;
  perSeatCapCredits?: number | null;
  seatLimit?: number;
}) {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) throw new Error("团队不存在");

    if (input.seatLimit != null) {
      const target = Math.max(1, Math.round(input.seatLimit));
      const current = await tx.seat.count({ where: { tenantId: input.tenantId } });
      if (target > current) {
        await Promise.all(
          Array.from({ length: target - current }).map((_, i) =>
            tx.seat.create({
              data: {
                tenantId: input.tenantId,
                status: "IDLE",
                label: `席位 ${current + i + 1}`,
              },
            }),
          ),
        );
      }
      // 缩容：仅删除空闲席位，不动已占用席位
      if (target < current) {
        const idle = await tx.seat.findMany({
          where: { tenantId: input.tenantId, status: "IDLE" },
          orderBy: { createdAt: "desc" },
          take: current - target,
        });
        if (idle.length > 0) {
          await tx.seat.deleteMany({
            where: { id: { in: idle.map((s) => s.id) } },
          });
        }
      }
    }

    const t = await tx.tenant.update({
      where: { id: input.tenantId },
      data: {
        name: input.name?.trim() || undefined,
        maxConcurrency: input.maxConcurrency ?? undefined,
        perSeatCapCredits:
          input.perSeatCapCredits === undefined
            ? undefined
            : input.perSeatCapCredits,
        seatLimit: input.seatLimit != null ? Math.max(1, Math.round(input.seatLimit)) : undefined,
      },
    });
    // 同步人均上限到积分账户
    if (input.perSeatCapCredits !== undefined) {
      await tx.creditAccount.updateMany({
        where: { ownerType: "TENANT", ownerId: input.tenantId },
        data: { perSeatCapCredits: input.perSeatCapCredits },
      });
    }
    return t;
  });
}

export { occupyIdleSeat };
