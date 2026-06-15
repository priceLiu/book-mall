/**
 * 团队邀请：OWNER/ADMIN 按手机号邀请 → 短信链接自带验证码 → 受邀人打开链接即可注册/登录并加入。
 */
import { randomBytes } from "crypto";

import type { TenantRole } from "@prisma/client";

import { normalizePhone } from "@/lib/auth/phone";
import { issueSmsCode } from "@/lib/auth/sms-verification-service";
import { prisma } from "@/lib/prisma";
import { buildTeamInviteUrl } from "@/lib/tenant/team-invite-link";
import { occupyIdleSeat, SeatUnavailableError } from "./tenant-service";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function genToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function createInvite(input: {
  tenantId: string;
  phone: string;
  role?: TenantRole;
  createdById: string;
  sendIp?: string | null;
}) {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new Error("手机号格式无效");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { seatLimit: true, name: true },
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

  const existingUser = await prisma.user.findUnique({ where: { phone } });
  if (existingUser) {
    const m = await prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId: input.tenantId, userId: existingUser.id } },
    });
    if (m && m.status === "ACTIVE") throw new Error("该用户已是团队成员");
  }

  const duplicatePending = await prisma.tenantInvite.findFirst({
    where: { tenantId: input.tenantId, phone, status: "PENDING" },
  });
  if (duplicatePending) throw new Error("该手机号已有待接受的邀请");

  const invite = await prisma.tenantInvite.create({
    data: {
      tenantId: input.tenantId,
      phone,
      token: genToken(),
      role: input.role ?? "MEMBER",
      status: "PENDING",
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      createdById: input.createdById,
    },
  });

  let urlCode: string | null = null;
  try {
    const issued = await issueSmsCode({
      phoneRaw: phone,
      purpose: "TEAM_INVITE",
      sendIp: input.sendIp,
      inviteToken: invite.token,
    });
    urlCode = issued.code;
    await prisma.tenantInvite.update({
      where: { id: invite.id },
      data: { urlCode },
    });
  } catch (e) {
    console.warn("[createInvite] sms failed", e);
  }

  return {
    invite: urlCode ? { ...invite, urlCode } : invite,
    inviteUrl: urlCode ? buildTeamInviteUrl(invite.token, urlCode) : null,
  };
}

export async function resolveInviteLink(token: string): Promise<string> {
  const invite = await getInviteByToken(token);
  if (!invite || invite.status !== "PENDING") {
    throw new Error("邀请无效或已失效");
  }
  if (invite.urlCode?.trim()) {
    return buildTeamInviteUrl(invite.token, invite.urlCode.trim());
  }
  const issued = await issueSmsCode({
    phoneRaw: invite.phone,
    purpose: "TEAM_INVITE",
    inviteToken: invite.token,
  });
  await prisma.tenantInvite.update({
    where: { id: invite.id },
    data: { urlCode: issued.code },
  });
  return buildTeamInviteUrl(invite.token, issued.code);
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

/** 接受邀请：要求 userId 的手机号与邀请一致。 */
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
      select: { phone: true, phoneVerifiedAt: true },
    });
    if (
      !user?.phone ||
      !user.phoneVerifiedAt ||
      normalizePhone(user.phone) !== normalizePhone(invite.phone)
    ) {
      throw new InviteInvalidError("当前登录手机号与邀请不一致");
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
