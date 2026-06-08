"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeCreditPrice,
  loadPricingConfig,
  MarginGuardError,
  publishModelCreditPrice,
} from "@/lib/pricing/credit-pricing-engine";
import type {
  CreditChannel,
  CreditCostUnit,
  MembershipFamily,
  MembershipInterval,
} from "@prisma/client";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return { ok: false, error: "需要管理员登录" };
  }
  return { ok: true, userId: session.user.id };
}

function num(v: FormDataEntryValue | null, fallback = 0): number {
  if (v == null) return fallback;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

function str(v: FormDataEntryValue | null): string {
  return (v?.toString() ?? "").trim();
}

// ——————————————————— PlatformPricingConfig ———————————————————

export async function savePricingConfigAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const creditAnchorYuan = num(formData.get("creditAnchorYuan"), 0.04);
  const defaultMarginM = num(formData.get("defaultMarginM"), 2.5);
  const minMarginGuard = num(formData.get("minMarginGuard"), 0.3);
  const defaultVideoSec = Math.max(1, Math.round(num(formData.get("defaultVideoSec"), 5)));
  if (creditAnchorYuan <= 0) return { ok: false, error: "锚定单价必须大于 0" };
  await prisma.platformPricingConfig.upsert({
    where: { id: "default" },
    create: { id: "default", creditAnchorYuan, defaultMarginM, minMarginGuard, defaultVideoSec },
    update: { creditAnchorYuan, defaultMarginM, minMarginGuard, defaultVideoSec },
  });
  revalidatePath("/admin/finance/credit-pricing");
  return { ok: true };
}

// ——————————————————— ModelCostProfile ———————————————————

export async function upsertModelCostAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const id = str(formData.get("id"));
  const vendor = str(formData.get("vendor"));
  const canonicalModelKey = str(formData.get("canonicalModelKey"));
  const channel = str(formData.get("channel")) as CreditChannel;
  const unit = str(formData.get("unit")) as CreditCostUnit;
  const tierRaw = str(formData.get("tierRaw")) || null;
  const credentialId = str(formData.get("credentialId")) || null;
  const listCostYuan = num(formData.get("listCostYuan"));
  const discountRate = Math.min(Math.max(num(formData.get("discountRate")), 0), 1);
  const note = str(formData.get("note")) || null;
  const active = formData.get("active") === "on" || formData.get("active") === "true";

  if (!vendor || !canonicalModelKey) return { ok: false, error: "厂商与归口模型键必填" };
  if (listCostYuan < 0) return { ok: false, error: "成本不能为负" };
  const netCostYuan = listCostYuan * (1 - discountRate);

  const data = {
    vendor,
    canonicalModelKey,
    channel: channel || "CHANNEL",
    credentialId,
    unit: unit || "PER_IMAGE",
    tierRaw,
    listCostYuan,
    discountRate,
    netCostYuan,
    note,
    active,
  };

  if (id) {
    await prisma.modelCostProfile.update({ where: { id }, data });
  } else {
    await prisma.modelCostProfile.create({ data });
  }
  revalidatePath("/admin/finance/model-cost");
  revalidatePath("/admin/finance/credit-pricing");
  return { ok: true };
}

export async function deleteModelCostAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "缺少 id" };
  await prisma.modelCostProfile.delete({ where: { id } });
  revalidatePath("/admin/finance/model-cost");
  return { ok: true };
}

// ——————————————————— 报价计算 + 发布 ———————————————————

export interface CalcPreview {
  netCostYuan: number;
  listPriceYuan: number;
  creditsPerUnit: number;
  baseMarginRate: number;
  belowGuard: boolean;
  minMarginGuard: number;
}

export async function previewCreditPriceAction(input: {
  listCostYuan: number;
  discountRate: number;
  marginM?: number;
}): Promise<ActionResult<CalcPreview>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const config = await loadPricingConfig();
  const marginM = input.marginM ?? config.defaultMarginM;
  const comp = computeCreditPrice({
    listCostYuan: input.listCostYuan,
    discountRate: input.discountRate,
    marginM,
    anchorYuan: config.creditAnchorYuan,
  });
  return {
    ok: true,
    data: {
      netCostYuan: comp.netCostYuan,
      listPriceYuan: comp.listPriceYuan,
      creditsPerUnit: comp.creditsPerUnit,
      baseMarginRate: comp.baseMarginRate,
      belowGuard: comp.baseMarginRate < config.minMarginGuard,
      minMarginGuard: config.minMarginGuard,
    },
  };
}

export async function publishModelPriceAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const canonicalModelKey = str(formData.get("canonicalModelKey"));
  const displayName = str(formData.get("displayName")) || canonicalModelKey;
  const marginMRaw = str(formData.get("marginM"));
  const marginM = marginMRaw ? Number(marginMRaw) : undefined;
  if (!canonicalModelKey) return { ok: false, error: "缺少归口模型键" };
  try {
    await publishModelCreditPrice({ canonicalModelKey, displayName, marginM, publishedBy: auth.userId });
    revalidatePath("/admin/finance/credit-pricing");
    revalidatePath("/pricing");
    return { ok: true };
  } catch (e) {
    if (e instanceof MarginGuardError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "发布失败" };
  }
}

export async function unpublishModelPriceAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const canonicalModelKey = str(formData.get("canonicalModelKey"));
  if (!canonicalModelKey) return { ok: false, error: "缺少归口模型键" };
  await prisma.modelCreditPrice.updateMany({
    where: { canonicalModelKey },
    data: { active: false },
  });
  revalidatePath("/admin/finance/credit-pricing");
  revalidatePath("/pricing");
  return { ok: true };
}

// ——————————————————— MembershipPlan + TeamSeatTier ———————————————————

export async function upsertMembershipPlanAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const id = str(formData.get("id"));
  const family = str(formData.get("family")) as MembershipFamily;
  const interval = str(formData.get("interval")) as MembershipInterval;
  const tier = str(formData.get("tier"));
  const sortOrder = Math.round(num(formData.get("sortOrder")));
  const priceYuan = num(formData.get("priceYuan"));
  const originalRaw = str(formData.get("originalYuan"));
  const originalYuan = originalRaw ? Number(originalRaw) : null;
  const promoLabel = str(formData.get("promoLabel")) || null;
  const monthlyCredits = Math.round(num(formData.get("monthlyCredits")));
  const includedSeats = Math.max(1, Math.round(num(formData.get("includedSeats"), 1)));
  const active = formData.get("active") === "on" || formData.get("active") === "true";

  if (!family || !interval || !tier) return { ok: false, error: "类型/周期/档位必填" };
  const data = {
    family,
    interval,
    tier,
    sortOrder,
    priceYuan,
    originalYuan,
    promoLabel,
    monthlyCredits,
    includedSeats,
    active,
  };
  if (id) {
    await prisma.membershipPlan.update({ where: { id }, data });
  } else {
    await prisma.membershipPlan.upsert({
      where: { family_interval_tier: { family, interval, tier } },
      create: data,
      update: data,
    });
  }
  revalidatePath("/admin/finance/membership-plans");
  revalidatePath("/pricing");
  return { ok: true };
}

export async function deleteMembershipPlanAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "缺少 id" };
  await prisma.membershipPlan.delete({ where: { id } });
  revalidatePath("/admin/finance/membership-plans");
  revalidatePath("/pricing");
  return { ok: true };
}

export async function upsertSeatTierAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const id = str(formData.get("id"));
  const planId = str(formData.get("planId"));
  const seatMin = Math.max(1, Math.round(num(formData.get("seatMin"), 1)));
  const seatMaxRaw = str(formData.get("seatMax"));
  const seatMax = seatMaxRaw ? Math.round(Number(seatMaxRaw)) : null;
  const perSeatPriceYuan = num(formData.get("perSeatPriceYuan"));
  const perSeatCredits = Math.round(num(formData.get("perSeatCredits")));
  const sortOrder = Math.round(num(formData.get("sortOrder")));
  if (!planId) return { ok: false, error: "缺少套餐 id" };
  const data = { planId, seatMin, seatMax, perSeatPriceYuan, perSeatCredits, sortOrder };
  if (id) {
    await prisma.teamSeatTier.update({ where: { id }, data });
  } else {
    await prisma.teamSeatTier.create({ data });
  }
  revalidatePath("/admin/finance/membership-plans");
  revalidatePath("/pricing");
  return { ok: true };
}

export async function deleteSeatTierAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "缺少 id" };
  await prisma.teamSeatTier.delete({ where: { id } });
  revalidatePath("/admin/finance/membership-plans");
  revalidatePath("/pricing");
  return { ok: true };
}

// ——————————————————— BYOK 服务费 + 资源系数 ———————————————————

export async function upsertByokConfigAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const id = str(formData.get("id"));
  const scopeKey = str(formData.get("scopeKey"));
  const label = str(formData.get("label"));
  const techServiceFeeYuan = num(formData.get("techServiceFeeYuan"));
  const interval = (str(formData.get("interval")) as MembershipInterval) || "MONTH";
  const note = str(formData.get("note")) || null;
  const active = formData.get("active") === "on" || formData.get("active") === "true";
  if (!scopeKey || !label) return { ok: false, error: "规格键与名称必填" };
  const data = { scopeKey, label, techServiceFeeYuan, interval, note, active };
  if (id) {
    await prisma.byokServiceConfig.update({ where: { id }, data });
  } else {
    await prisma.byokServiceConfig.upsert({ where: { scopeKey }, create: data, update: data });
  }
  revalidatePath("/admin/finance/byok");
  return { ok: true };
}

export async function deleteByokConfigAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "缺少 id" };
  await prisma.byokServiceConfig.delete({ where: { id } });
  revalidatePath("/admin/finance/byok");
  return { ok: true };
}

export async function saveResourceRateAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const resourceType = str(formData.get("resourceType")) as "OSS_GB_MONTH" | "EGRESS_GB" | "TASK_COUNT";
  const coefficientYuan = num(formData.get("coefficientYuan"));
  const unitLabel = str(formData.get("unitLabel"));
  const active = formData.get("active") === "on" || formData.get("active") === "true";
  if (!resourceType) return { ok: false, error: "缺少资源类型" };
  await prisma.resourceMeterRate.upsert({
    where: { resourceType },
    create: { resourceType, coefficientYuan, unitLabel, active },
    update: { coefficientYuan, unitLabel, active },
  });
  revalidatePath("/admin/finance/byok");
  return { ok: true };
}
