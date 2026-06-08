/**
 * 团队邀请（gateway-multi-credential-and-tenant · 轨道 B）
 *
 * 流程：OWNER/ADMIN 生成邀请（带 token、角色、有效期）→ 受邀人登录后凭 token 接受 →
 * 自动建/复活 TenantMember 并占用一个空闲席位。
 */
import { randomBytes } from "crypto";

import type { TenantRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { occupyIdleSeat, SeatUnavailableError } from "./tenant-service";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function genToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function createInvite(input: {
  tenantId: string;
  email: string;
  role?: TenantRole;
  createdById: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("邮箱格式无效");
  }
  // 校验席位：占用 + 待接受邀请 不得超过席位上限
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { seatLimit: true },
  });
  if (!tenant) throw new Error("团队不存在");
  const [occupied, pending] = await Promise.all([
    prisma.tenantMember.count({
      where: { tenantId: input.tenantId, status: "ACTIVE" },
    }),
    prisma.tenantInvite.count({
      where: { tenantId: input.tenantId, status: "PENDING" },
    }),
  ]);
  if (occupied + pending >= tenant.seatLimit) {
    throw new SeatUnavailableError();
  }

  // 已是活跃成员则拒绝
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const m = await prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId: input.tenantId, userId: existingUser.id } },
    });
    if (m && m.status === "ACTIVE") throw new Error("该用户已是团队成员");
  }

  return prisma.tenantInvite.create({
    data: {
      tenantId: input.tenantId,
      email,
      token: genToken(),
      role: input.role ?? "MEMBER",
      status: "PENDING",
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      createdById: input.createdById,
    },
  });
}

export async function getInviteByToken(token: string) {
  const invite = await prisma.tenantInvite.findUnique({
    where: { token },
    include: { tenant: { select: { id: true, name: true, type: true } } },
  });
  if (!invite) return null;
  if (invite.status === "PENDING" && invite.expiresAt < new Date()) {
    await prisma.tenantInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return { ...invite, status: "EXPIRED" as const };
  }
  return invite;
}

export async function listInvites(tenantId: string) {
  return prisma.tenantInvite.findMany({
    where: { tenantId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeInvite(input: { tenantId: string; inviteId: string }) {
  const invite = await prisma.tenantInvite.findUnique({
    where: { id: input.inviteId },
  });
  if (!invite || invite.tenantId !== input.tenantId) throw new Error("邀请不存在");
  return prisma.tenantInvite.update({
    where: { id: input.inviteId },
    data: { status: "REVOKED" },
  });
}

export class InviteInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InviteInvalidError";
  }
}

/** 接受邀请：建/复活成员并占席。要求 userId 的邮箱与邀请一致（防止串号）。 */
export async function acceptInvite(input: { token: string; userId: string }) {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.tenantInvite.findUnique({
      where: { token: input.token },
    });
    if (!invite) throw new InviteInvalidError("邀请不存在");
    if (invite.status !== "PENDING") throw new InviteInvalidError("邀请已失效");
    if (invite.expiresAt < new Date()) {
      await tx.tenantInvite.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      });
      throw new InviteInvalidError("邀请已过期");
    }

    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });
    if (!user?.email || user.email.trim().toLowerCase() !== invite.email) {
      throw new InviteInvalidError("当前登录邮箱与邀请邮箱不一致");
    }

    const seatId = await occupyIdleSeat(tx, invite.tenantId);
    if (!seatId) throw new SeatUnavailableError();

    const existing = await tx.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId: invite.tenantId, userId: input.userId } },
    });
    const member = existing
      ? await tx.tenantMember.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", role: invite.role, seatId },
        })
      : await tx.tenantMember.create({
          data: {
            tenantId: invite.tenantId,
            userId: input.userId,
            role: invite.role,
            status: "ACTIVE",
            seatId,
          },
        });

    await tx.tenantInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    return member;
  });
}
