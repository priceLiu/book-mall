/**
 * VIP 大额套餐 · 开通服务（管理员/财务后台）
 *
 * 依据测算器选定的方案（通用/视频积分），为客户创建 VIP 团队租户并一次性发放
 * 双池积分。VIP 为一次性预充：monthlyGrantCredits = 0、currentPeriodEnd = null，
 * 因此月度重置脚本（若启用）会跳过该账户，积分长期有效、不清零。
 */
import { prisma } from "@/lib/prisma";
import { createTeamTenant } from "@/lib/tenant/tenant-service";
import { grantCredits } from "@/lib/billing/credit-account-service";
import {
  computeVipCreditScheme,
  computeVipSeatAllocation,
  VIP_MIN_AMOUNT_YUAN,
} from "./vip-package-calculator";

export type VipSchemeKind = "general_heavy" | "video_heavy";

export interface ProvisionVipPackageInput {
  ownerUserId: string;
  teamName: string;
  amountYuan: number;
  targetMargin: number;
  scheme: VipSchemeKind;
  videoFraction: number;
  seats: number;
  adminUserId: string;
}

export type ProvisionVipPackageResult =
  | {
      ok: true;
      tenantId: string;
      generalCredits: number;
      videoCredits: number;
      perSeatGeneral: number;
      perSeatVideo: number;
    }
  | { ok: false; reason: string };

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

  const scheme = computeVipCreditScheme({
    amountYuan: amount,
    targetMargin: input.targetMargin,
    videoFraction: input.videoFraction,
  });

  const alloc = computeVipSeatAllocation({
    totalGeneralCredits: scheme.generalCredits,
    totalVideoCredits: scheme.videoCredits,
    seats,
  });

  const tenant = await createTeamTenant({
    ownerUserId: input.ownerUserId,
    name: input.teamName?.trim() || "VIP 团队",
    planId: null,
    packageLevel: "VIP",
    interval: null,
    seatLimit: seats,
    // 人均通用积分上限（治理用；余数归首席不额外放宽）
    perSeatCapCredits: alloc.perSeatGeneral > 0 ? alloc.perSeatGeneral : null,
  });

  // 一次性发放：monthlyGrant = 0（不触发月度重置），批次 TOPUP + 永久（expiresAt=null），长期有效不清零。
  await grantCredits({
    ref: { ownerType: "TENANT", ownerId: tenant.id },
    credits: scheme.generalCredits,
    videoCredits: scheme.videoCredits,
    monthlyGrantCredits: 0,
    videoMonthlyGrantCredits: 0,
    pricePerCreditYuan: scheme.pricePerCreditYuan,
    currentPeriodEnd: null,
    perSeatCapCredits: alloc.perSeatGeneral > 0 ? alloc.perSeatGeneral : null,
    lotSource: "TOPUP",
    lotExpiresAt: null,
    idempotencyKey: `vip_grant:${tenant.id}`,
    description: `VIP 套餐开通（充值 ¥${amount.toLocaleString()} · ${
      input.scheme === "video_heavy" ? "视频多" : "通用多"
    }方案 · 目标毛利 ${(input.targetMargin * 100).toFixed(0)}% · 操作人 ${input.adminUserId}）`,
  });

  return {
    ok: true,
    tenantId: tenant.id,
    generalCredits: scheme.generalCredits,
    videoCredits: scheme.videoCredits,
    perSeatGeneral: alloc.perSeatGeneral,
    perSeatVideo: alloc.perSeatVideo,
  };
}
