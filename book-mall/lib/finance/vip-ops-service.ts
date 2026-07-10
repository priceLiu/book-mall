/**
 * VIP 大额预充 · 财务后台运维（客户查找、团队详情、积分/席位）
 */
import type { VipDealDocumentKind } from "@prisma/client";

import { adjustCredits, ensureCreditAccount, grantCredits } from "@/lib/billing/credit-account-service";
import { prisma } from "@/lib/prisma";
import { updateTenantConfig } from "@/lib/tenant/tenant-service";
import { normalizePhone } from "@/lib/auth/phone";
import { createInvite, listInvites } from "@/lib/tenant/tenant-invite-service";
import { VIP_CREDIT_VALIDITY_YEARS } from "./vip-package-calculator";
import { addMonths } from "@/lib/billing/credit-lot-logic";

function vipLotExpiresAt(from = new Date()): Date {
  return addMonths(from, VIP_CREDIT_VALIDITY_YEARS * 12);
}

export async function resolveFinanceUserByPhone(phoneRaw: string) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) return null;
  return prisma.user.findUnique({
    where: { phone },
    select: { id: true, name: true, email: true, phone: true },
  });
}

export async function lookupFinanceUsers(query: string) {
  const q = query.trim();
  if (!q) return [];

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: q },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 20,
    select: { id: true, name: true, email: true, phone: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const enriched = await Promise.all(
    users.map(async (u) => {
      const vipTeam = await prisma.tenantMember.findFirst({
        where: {
          userId: u.id,
          role: "OWNER",
          status: "ACTIVE",
          tenant: { type: "TEAM", status: "ACTIVE", packageLevel: "VIP" },
        },
        select: { tenantId: true, tenant: { select: { name: true, seatLimit: true } } },
      });
      return {
        ...u,
        vipTenantId: vipTeam?.tenantId ?? null,
        vipTeamName: vipTeam?.tenant.name ?? null,
        vipSeatLimit: vipTeam?.tenant.seatLimit ?? null,
      };
    }),
  );

  return enriched;
}

export async function listVipTeams(take = 50) {
  const tenants = await prisma.tenant.findMany({
    where: { type: "TEAM", status: "ACTIVE", packageLevel: "VIP" },
    orderBy: { updatedAt: "desc" },
    take: Math.min(200, Math.max(1, take)),
    select: {
      id: true,
      name: true,
      ownerUserId: true,
      seatLimit: true,
      perSeatCapCredits: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const ownerIds = [...new Set(tenants.map((t) => t.ownerUserId))];
  const owners =
    ownerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true, email: true, phone: true },
        })
      : [];
  const ownerMap = new Map(owners.map((o) => [o.id, o]));

  return Promise.all(
    tenants.map(async (t) => {
      const account = await ensureCreditAccount({ ownerType: "TENANT", ownerId: t.id }, null);
      const members = await prisma.tenantMember.count({
        where: { tenantId: t.id, status: "ACTIVE" },
      });
      const docs = await prisma.vipDealDocument.count({ where: { tenantId: t.id } });
      return {
        tenantId: t.id,
        name: t.name,
        seatLimit: t.seatLimit,
        activeMembers: members,
        perSeatCapCredits: t.perSeatCapCredits,
        generalCredits: account.balanceCredits,
        videoCredits: account.videoBalanceCredits ?? 0,
        owner: ownerMap.get(t.ownerUserId) ?? { id: t.ownerUserId, name: null, email: null, phone: null },
        documentCount: docs,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    }),
  );
}

export async function getVipTenantOpsDetail(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      packageLevel: true,
      ownerUserId: true,
      seatLimit: true,
      perSeatCapCredits: true,
      maxConcurrency: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!tenant || tenant.type !== "TEAM") return null;

  const account = await ensureCreditAccount({ ownerType: "TENANT", ownerId: tenantId }, null);

  const [owner, members, seats, documents, lots, invites] = await Promise.all([
    prisma.user.findUnique({
      where: { id: tenant.ownerUserId },
      select: { id: true, name: true, email: true, phone: true },
    }),
    prisma.tenantMember.findMany({
      where: { tenantId, status: "ACTIVE" },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      select: {
        id: true,
        userId: true,
        role: true,
        monthlyCapCredits: true,
        seatId: true,
        user: { select: { name: true, email: true, phone: true } },
        seat: { select: { label: true, status: true } },
      },
    }),
    prisma.seat.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      select: { id: true, label: true, status: true },
    }),
    prisma.vipDealDocument.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.creditLot.findMany({
      where: { accountId: account.id },
      orderBy: { expiresAt: "asc" },
      take: 20,
      select: {
        id: true,
        pool: true,
        source: true,
        remainingCredits: true,
        expiresAt: true,
        grantedAt: true,
      },
    }),
    listInvites(tenantId),
  ]);

  return {
    tenant: {
      ...tenant,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
    },
    owner,
    credits: {
      general: account.balanceCredits,
      video: account.videoBalanceCredits ?? 0,
      perSeatCapCredits: account.perSeatCapCredits,
    },
    members,
    seats,
    documents: documents.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    })),
    creditLots: lots.map((l) => ({
      ...l,
      expiresAt: l.expiresAt?.toISOString() ?? null,
      grantedAt: l.grantedAt.toISOString(),
    })),
    invites: invites.map((inv) => ({
      id: inv.id,
      phone: inv.phone,
      role: inv.role,
      status: inv.status,
      plannedGeneralCredits: inv.plannedGeneralCredits,
      plannedVideoCredits: inv.plannedVideoCredits,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    })),
  };
}

export async function adminUpdateVipTenantConfig(input: {
  tenantId: string;
  seatLimit?: number;
  perSeatCapCredits?: number | null;
  maxConcurrency?: number;
  name?: string;
  adminUserId: string;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant || tenant.packageLevel !== "VIP") {
    throw new Error("非 VIP 团队");
  }

  await updateTenantConfig({
    tenantId: input.tenantId,
    seatLimit: input.seatLimit,
    perSeatCapCredits: input.perSeatCapCredits,
    maxConcurrency: input.maxConcurrency,
    name: input.name,
  });

  return getVipTenantOpsDetail(input.tenantId);
}

export async function adminGrantVipTestCredits(input: {
  tenantId: string;
  generalCredits?: number;
  videoCredits?: number;
  description?: string;
  adminUserId: string;
  idempotencyKey?: string;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant || tenant.packageLevel !== "VIP") {
    throw new Error("非 VIP 团队");
  }

  const general = Math.max(0, Math.round(input.generalCredits ?? 0));
  const video = Math.max(0, Math.round(input.videoCredits ?? 0));
  if (general === 0 && video === 0) throw new Error("请填写通用或视频积分");

  const expiresAt = vipLotExpiresAt();
  const key =
    input.idempotencyKey?.trim() ||
    `vip_admin_test:${input.tenantId}:${input.adminUserId}:${Date.now()}`;

  await grantCredits({
    ref: { ownerType: "TENANT", ownerId: input.tenantId },
    credits: general,
    videoCredits: video,
    monthlyGrantCredits: 0,
    videoMonthlyGrantCredits: 0,
    currentPeriodEnd: null,
    lotSource: "TOPUP",
    lotExpiresAt: expiresAt,
    idempotencyKey: key,
    description: input.description?.trim() || `VIP 后台积分发放（操作人 ${input.adminUserId}）`,
  });

  return getVipTenantOpsDetail(input.tenantId);
}

export async function adminAdjustVipCredits(input: {
  tenantId: string;
  credits: number;
  pool?: "GENERAL" | "VIDEO";
  description?: string;
  adminUserId: string;
  idempotencyKey?: string;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant || tenant.packageLevel !== "VIP") {
    throw new Error("非 VIP 团队");
  }

  const amount = Math.round(input.credits);
  if (amount === 0) throw new Error("调整数额不能为 0");

  const key =
    input.idempotencyKey?.trim() ||
    `vip_admin_adjust:${input.tenantId}:${input.adminUserId}:${Date.now()}`;

  await adjustCredits({
    ref: { ownerType: "TENANT", ownerId: input.tenantId },
    credits: amount,
    pool: input.pool ?? "GENERAL",
    actorUserId: input.adminUserId,
    idempotencyKey: key,
    description: input.description?.trim() || `VIP 后台积分校正（操作人 ${input.adminUserId}）`,
  });

  return getVipTenantOpsDetail(input.tenantId);
}

export async function adminSetMemberMonthlyCap(input: {
  tenantId: string;
  memberId: string;
  monthlyCapCredits: number | null;
}) {
  const member = await prisma.tenantMember.findFirst({
    where: { id: input.memberId, tenantId: input.tenantId, status: "ACTIVE" },
  });
  if (!member) throw new Error("成员不存在");

  await prisma.tenantMember.update({
    where: { id: member.id },
    data: { monthlyCapCredits: input.monthlyCapCredits },
  });

  return getVipTenantOpsDetail(input.tenantId);
}

export async function adminCreateVipInvite(input: {
  tenantId: string;
  phone: string;
  plannedGeneralCredits?: number | null;
  plannedVideoCredits?: number | null;
  adminUserId: string;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant || tenant.packageLevel !== "VIP") {
    throw new Error("非 VIP 团队");
  }
  const { inviteUrl } = await createInvite({
    tenantId: input.tenantId,
    phone: input.phone,
    createdById: input.adminUserId,
    plannedGeneralCredits: input.plannedGeneralCredits,
    plannedVideoCredits: input.plannedVideoCredits,
  });
  const detail = await getVipTenantOpsDetail(input.tenantId);
  return { inviteUrl, detail };
}

export async function adminResolveVipInviteLink(input: { tenantId: string; inviteId: string }) {
  const invite = await prisma.tenantInvite.findFirst({
    where: { id: input.inviteId, tenantId: input.tenantId, status: "PENDING" },
  });
  if (!invite) throw new Error("邀请不存在或已失效");
  const { resolveInviteLink } = await import("@/lib/tenant/tenant-invite-service");
  const inviteUrl = await resolveInviteLink(invite.token);
  return { inviteUrl };
}

export async function listVipDocuments(filter: { tenantId?: string; ownerUserId?: string }) {
  return prisma.vipDealDocument.findMany({
    where: {
      ...(filter.tenantId ? { tenantId: filter.tenantId } : {}),
      ...(filter.ownerUserId ? { ownerUserId: filter.ownerUserId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function recordVipDocument(input: {
  tenantId?: string | null;
  ownerUserId?: string | null;
  kind: VipDealDocumentKind;
  ossUrl: string;
  filename: string;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  note?: string | null;
  uploadedByUserId: string;
}) {
  return prisma.vipDealDocument.create({
    data: {
      tenantId: input.tenantId ?? null,
      ownerUserId: input.ownerUserId ?? null,
      kind: input.kind,
      ossUrl: input.ossUrl,
      filename: input.filename,
      mimeType: input.mimeType ?? null,
      fileSizeBytes: input.fileSizeBytes ?? null,
      note: input.note?.trim() || null,
      uploadedByUserId: input.uploadedByUserId,
    },
  });
}
