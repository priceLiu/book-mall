/**
 * VIP 大额套餐 · 开通服务（管理员/财务后台 + 线上下单）
 *
 * 依据测算器选定的方案（通用/视频积分），为客户创建 VIP 团队租户并一次性发放
 * 双池积分。VIP 为一次性预充：monthlyGrantCredits = 0、currentPeriodEnd = null，
 * 因此月度重置脚本（若启用）会跳过该账户，积分长期有效、不清零。
 */
import { grantCredits } from "@/lib/billing/credit-account-service";
import { addMonths } from "@/lib/billing/credit-lot-logic";
import { ensurePlatformManagedKeyForTenant } from "@/lib/gateway/platform-managed-key";
import { prisma } from "@/lib/prisma";
import { createTeamTenant, updateTenantConfig } from "@/lib/tenant/tenant-service";
import {
  buildAutoSeatPlans,
  computeVipCreditScheme,
  computeVipSeatAllocation,
  validateVipManualAllocation,
  type VipSeatPlan,
  VIP_CREDIT_VALIDITY_YEARS,
  VIP_DEFAULT_TARGET_MARGIN,
  VIP_GENERAL_HEAVY_VIDEO_FRACTION,
  VIP_MIN_AMOUNT_YUAN,
  VIP_VIDEO_HEAVY_VIDEO_FRACTION,
} from "./vip-package-calculator";
import { normalizePhone } from "@/lib/auth/phone";
import { createInvite } from "@/lib/tenant/tenant-invite-service";

function vipLotExpiresAt(from = new Date()): Date {
  return addMonths(from, VIP_CREDIT_VALIDITY_YEARS * 12);
}

export type VipSchemeKind = "general_heavy" | "video_heavy";

export function resolveVipVideoFraction(scheme: VipSchemeKind): number {
  return scheme === "video_heavy"
    ? VIP_VIDEO_HEAVY_VIDEO_FRACTION
    : VIP_GENERAL_HEAVY_VIDEO_FRACTION;
}

export type VipAllocationMode = "auto" | "manual";

export interface ProvisionSeatPlanInput {
  phone?: string | null;
  role?: "OWNER" | "MEMBER";
  generalCredits: number;
  videoCredits: number;
  label?: string | null;
}

export interface ProvisionVipPackageInput {
  ownerUserId: string;
  ownerPhone?: string | null;
  teamName: string;
  amountYuan: number;
  targetMargin: number;
  scheme: VipSchemeKind;
  videoFraction: number;
  seats: number;
  adminUserId: string;
  allocationMode?: VipAllocationMode;
  seatPlans?: ProvisionSeatPlanInput[];
  sendInvites?: boolean;
}

export type ProvisionVipPackageResult =
  | {
      ok: true;
      tenantId: string;
      generalCredits: number;
      videoCredits: number;
      perSeatGeneral: number;
      perSeatVideo: number;
      seatPlans: VipSeatPlan[];
      invitesSent: { phone: string; inviteUrl: string | null }[];
    }
  | { ok: false; reason: string };

async function resolveSeatPlans(input: {
  scheme: ReturnType<typeof computeVipCreditScheme>;
  seats: number;
  allocationMode: VipAllocationMode;
  seatPlans?: ProvisionSeatPlanInput[];
  ownerPhone?: string | null;
}): Promise<VipSeatPlan[]> {
  if (input.allocationMode === "manual" && input.seatPlans?.length) {
    const manual = input.seatPlans.map((p, i) => ({
      seatIndex: i + 1,
      label: p.label?.trim() || (i === 0 ? "首席席" : `席位 ${i + 1}`),
      phone: p.phone?.trim() || undefined,
      role: (p.role ?? (i === 0 ? "OWNER" : "MEMBER")) as "OWNER" | "MEMBER",
      generalCredits: Math.max(0, Math.round(p.generalCredits)),
      videoCredits: Math.max(0, Math.round(p.videoCredits)),
      isChief: i === 0,
    }));
    const check = validateVipManualAllocation({
      totalGeneralCredits: input.scheme.generalCredits,
      totalVideoCredits: input.scheme.videoCredits,
      perSeat: manual,
    });
    if (!check.ok) throw new Error(check.reason ?? "手动分配合计不正确");
    return manual;
  }

  return buildAutoSeatPlans({
    totalGeneralCredits: input.scheme.generalCredits,
    totalVideoCredits: input.scheme.videoCredits,
    seats: input.seats,
    ownerPhone: input.ownerPhone ?? undefined,
  });
}

async function applyOwnerCap(tenantId: string, ownerUserId: string, plan: VipSeatPlan) {
  const member = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId, userId: ownerUserId } },
  });
  if (!member) return;
  await prisma.tenantMember.update({
    where: { id: member.id },
    data: { monthlyCapCredits: plan.generalCredits > 0 ? plan.generalCredits : null },
  });
}

async function sendSeatInvites(input: {
  tenantId: string;
  ownerUserId: string;
  seatPlans: VipSeatPlan[];
  adminUserId: string;
}) {
  const owner = await prisma.user.findUnique({
    where: { id: input.ownerUserId },
    select: { phone: true },
  });
  const ownerPhone = owner?.phone ? normalizePhone(owner.phone) : null;
  const sent: { phone: string; inviteUrl: string | null }[] = [];

  for (const plan of input.seatPlans) {
    if (plan.role === "OWNER") continue;
    const phone = plan.phone ? normalizePhone(plan.phone) : null;
    if (!phone || (ownerPhone && phone === ownerPhone)) continue;
    try {
      const { inviteUrl } = await createInvite({
        tenantId: input.tenantId,
        phone,
        role: "MEMBER",
        createdById: input.adminUserId,
        plannedGeneralCredits: plan.generalCredits,
        plannedVideoCredits: plan.videoCredits,
      });
      sent.push({ phone, inviteUrl });
    } catch (e) {
      console.warn("[vip-provision] invite failed", phone, e);
      sent.push({ phone, inviteUrl: null });
    }
  }
  return sent;
}

async function findOwnedVipTeam(userId: string) {
  return prisma.tenantMember.findFirst({
    where: {
      userId,
      role: "OWNER",
      status: "ACTIVE",
      tenant: { type: "TEAM", status: "ACTIVE", packageLevel: "VIP" },
    },
    select: { tenantId: true, tenant: { select: { seatLimit: true, name: true } } },
  });
}

async function grantVipCredits(input: {
  tenantId: string;
  scheme: ReturnType<typeof computeVipCreditScheme>;
  alloc: ReturnType<typeof computeVipSeatAllocation>;
  amountYuan: number;
  schemeKind: VipSchemeKind;
  targetMargin: number;
  idempotencyKey: string;
  description: string;
}) {
  await grantCredits({
    ref: { ownerType: "TENANT", ownerId: input.tenantId },
    credits: input.scheme.generalCredits,
    videoCredits: input.scheme.videoCredits,
    monthlyGrantCredits: 0,
    videoMonthlyGrantCredits: 0,
    pricePerCreditYuan: input.scheme.pricePerCreditYuan,
    currentPeriodEnd: null,
    perSeatCapCredits: input.alloc.perSeatGeneral > 0 ? input.alloc.perSeatGeneral : null,
    lotSource: "TOPUP",
    lotExpiresAt: vipLotExpiresAt(),
    idempotencyKey: input.idempotencyKey,
    description: input.description,
  });
}

export async function provisionVipPackage(
  input: ProvisionVipPackageInput,
): Promise<ProvisionVipPackageResult> {
  const amount = Math.round(input.amountYuan || 0);
  if (amount < VIP_MIN_AMOUNT_YUAN) {
    return { ok: false, reason: `VIP 起订金额为 ¥${VIP_MIN_AMOUNT_YUAN.toLocaleString()}` };
  }
  const seats = Math.max(1, Math.round(input.seats || 1));

  const owner = await prisma.user.findUnique({
    where: { id: input.ownerUserId },
    select: { id: true },
  });
  if (!owner) return { ok: false, reason: "客户用户不存在（ownerUserId 无效）" };

  try {
    const result = await fulfillVipPackageFromPayment({
      userId: input.ownerUserId,
      checkoutId: `admin:${input.adminUserId}:${Date.now()}`,
      amountYuan: amount,
      scheme: input.scheme,
      seats,
      teamName: input.teamName?.trim() || "VIP 团队",
      targetMargin: input.targetMargin,
      allocationMode: input.allocationMode ?? "auto",
      seatPlans: input.seatPlans,
      ownerPhone: input.ownerPhone,
      sendInvites: input.sendInvites ?? true,
      adminUserId: input.adminUserId,
    });

    return {
      ok: true,
      tenantId: result.tenantId,
      generalCredits: result.generalCredits,
      videoCredits: result.videoCredits,
      perSeatGeneral: result.perSeatGeneral,
      perSeatVideo: result.perSeatVideo,
      seatPlans: result.seatPlans,
      invitesSent: result.invitesSent,
    };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** 线上下单确认后：新建 VIP 团队，或向已有 VIP 团队追加积分。 */
export async function fulfillVipPackageFromPayment(input: {
  userId: string;
  checkoutId: string;
  amountYuan: number;
  scheme: VipSchemeKind;
  seats: number;
  teamName?: string | null;
  targetMargin?: number;
  allocationMode?: VipAllocationMode;
  seatPlans?: ProvisionSeatPlanInput[];
  ownerPhone?: string | null;
  sendInvites?: boolean;
  adminUserId?: string;
}) {
  const amount = Math.round(input.amountYuan || 0);
  if (amount < VIP_MIN_AMOUNT_YUAN) {
    throw new Error(`VIP 起订金额为 ¥${VIP_MIN_AMOUNT_YUAN.toLocaleString()}`);
  }

  const seats = Math.max(1, Math.round(input.seats || 1));
  const targetMargin = input.targetMargin ?? VIP_DEFAULT_TARGET_MARGIN;
  const videoFraction = resolveVipVideoFraction(input.scheme);

  const scheme = computeVipCreditScheme({
    amountYuan: amount,
    targetMargin,
    videoFraction,
  });

  const alloc = computeVipSeatAllocation({
    totalGeneralCredits: scheme.generalCredits,
    totalVideoCredits: scheme.videoCredits,
    seats,
  });

  const allocationMode = input.allocationMode ?? "auto";
  const seatPlans = await resolveSeatPlans({
    scheme,
    seats,
    allocationMode,
    seatPlans: input.seatPlans,
    ownerPhone: input.ownerPhone,
  });
  const ownerPlan = seatPlans.find((p) => p.role === "OWNER") ?? seatPlans[0];

  const existing = await findOwnedVipTeam(input.userId);
  let tenantId: string;

  if (existing) {
    tenantId = existing.tenantId;
    if (seats > existing.tenant.seatLimit) {
      await updateTenantConfig({
        tenantId,
        seatLimit: seats,
        perSeatCapCredits: alloc.perSeatGeneral > 0 ? alloc.perSeatGeneral : null,
      });
    } else if (alloc.perSeatGeneral > 0) {
      await updateTenantConfig({
        tenantId,
        perSeatCapCredits: alloc.perSeatGeneral,
      });
    }
  } else {
    const tenant = await createTeamTenant({
      ownerUserId: input.userId,
      name: input.teamName?.trim() || "VIP 团队",
      planId: null,
      packageLevel: "VIP",
      interval: null,
      seatLimit: seats,
      perSeatCapCredits: alloc.perSeatGeneral > 0 ? alloc.perSeatGeneral : null,
    });
    tenantId = tenant.id;
    try {
      await ensurePlatformManagedKeyForTenant(tenantId);
    } catch {
      /* non-fatal */
    }
    await prisma.user.update({
      where: { id: input.userId },
      data: { primaryTenantId: tenantId },
    });
  }

  const schemeLabel = input.scheme === "video_heavy" ? "视频多" : "通用多";
  await grantVipCredits({
    tenantId,
    scheme,
    alloc,
    amountYuan: amount,
    schemeKind: input.scheme,
    targetMargin,
    idempotencyKey: `payment_checkout:${input.checkoutId}`,
    description: `VIP 套餐${existing ? "续充" : "开通"}（充值 ¥${amount.toLocaleString()} · ${schemeLabel}方案 · ${seats} 席）`,
  });

  if (ownerPlan) {
    await applyOwnerCap(tenantId, input.userId, ownerPlan);
  }

  let invitesSent: { phone: string; inviteUrl: string | null }[] = [];
  if (input.sendInvites && input.adminUserId) {
    invitesSent = await sendSeatInvites({
      tenantId,
      ownerUserId: input.userId,
      seatPlans,
      adminUserId: input.adminUserId,
    });
  }

  return {
    tenantId,
    generalCredits: scheme.generalCredits,
    videoCredits: scheme.videoCredits,
    perSeatGeneral: alloc.perSeatGeneral,
    perSeatVideo: alloc.perSeatVideo,
    renewed: !!existing,
    seatPlans,
    invitesSent,
  };
}
