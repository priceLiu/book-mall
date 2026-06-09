"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  computeCreditPrice,
  loadPricingConfig,
  MarginGuardError,
  marginPassesGuard,
  publishModelCreditPrice,
} from "@/lib/pricing/credit-pricing-engine";
import { SCENARIO_LAB_USAGE_SECONDS, SCENARIO_LAB_VIDEO_MARGIN_M } from "@/lib/billing/scenario-lab";
import { VIDEO_MODEL_SEEDS } from "@/lib/billing/video-model-seeds";
import { DEFAULT_VIDEO_MIN_MARGIN_GUARD } from "@/lib/pricing/credit-pricing-formulas";
import { simulatePlanChange } from "@/lib/pricing/pricing-simulation";
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
  if (!session?.user?.id || !canManagePricing(session.user.role)) {
    return { ok: false, error: "需要财务/超管权限" };
  }
  return { ok: true, userId: session.user.id };
}

function num(v: FormDataEntryValue | null, fallback = 0): number {
  if (v == null) return fallback;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

function derivePricePerCredit(priceYuan: number, monthlyCredits: number, includedSeats: number): number {
  const denom = Math.max(1, includedSeats) * monthlyCredits;
  if (denom <= 0) return 0;
  return Math.round((priceYuan / denom) * 1e6) / 1e6;
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
  const defaultVideoSec = Math.max(1, Math.round(num(formData.get("defaultVideoSec"), 15)));
  const videoMarginM = num(formData.get("videoMarginM"), 4);
  const videoMinMarginGuard = num(formData.get("videoMinMarginGuard"), 0.75);
  if (creditAnchorYuan <= 0) return { ok: false, error: "锚定单价必须大于 0" };
  await prisma.platformPricingConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      creditAnchorYuan,
      defaultMarginM,
      minMarginGuard,
      defaultVideoSec,
      videoMarginM,
      videoMinMarginGuard,
    },
    update: { creditAnchorYuan, defaultMarginM, minMarginGuard, defaultVideoSec, videoMarginM, videoMinMarginGuard },
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

export type ModelCostImportRow = {
  vendor: string;
  canonicalModelKey: string;
  channel?: CreditChannel;
  unit?: CreditCostUnit;
  tierRaw?: string | null;
  credentialId?: string | null;
  listCostYuan: number;
  discountRate?: number;
  note?: string | null;
  active?: boolean;
};

/** 批量导入/覆盖模型成本档（JSON 数组）。 */
export async function importModelCostsAction(
  rows: ModelCostImportRow[],
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "导入数据为空" };
  }

  let imported = 0;
  let skipped = 0;

  for (const raw of rows) {
    const vendor = (raw.vendor ?? "").trim();
    const canonicalModelKey = (raw.canonicalModelKey ?? "").trim();
    if (!vendor || !canonicalModelKey) {
      skipped++;
      continue;
    }
    const listCostYuan = Number(raw.listCostYuan);
    if (!Number.isFinite(listCostYuan) || listCostYuan < 0) {
      skipped++;
      continue;
    }
    const discountRate = Math.min(Math.max(Number(raw.discountRate ?? 0), 0), 1);
    const channel = (raw.channel ?? "CHANNEL") as CreditChannel;
    const unit = (raw.unit ?? "PER_IMAGE") as CreditCostUnit;
    const tierRaw = raw.tierRaw?.trim() || null;
    const netCostYuan = listCostYuan * (1 - discountRate);
    const active = raw.active !== false;

    const existing = await prisma.modelCostProfile.findFirst({
      where: {
        vendor,
        canonicalModelKey,
        channel,
        unit,
        tierRaw,
      },
    });

    const data = {
      vendor,
      canonicalModelKey,
      channel,
      credentialId: raw.credentialId?.trim() || null,
      unit,
      tierRaw,
      listCostYuan,
      discountRate,
      netCostYuan,
      note: raw.note?.trim() || null,
      active,
    };

    if (existing) {
      await prisma.modelCostProfile.update({ where: { id: existing.id }, data });
    } else {
      await prisma.modelCostProfile.create({ data });
    }
    imported++;
  }

  revalidatePath("/admin/finance/model-cost");
  revalidatePath("/admin/finance/credit-pricing");
  return { ok: true, data: { imported, skipped } };
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
      belowGuard: !marginPassesGuard(comp.baseMarginRate, config.minMarginGuard),
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
  const videoMonthlyRaw = formData.get("videoMonthlyCredits");
  const videoMonthlyCredits =
    videoMonthlyRaw != null && String(videoMonthlyRaw).trim() !== ""
      ? Math.max(0, Math.round(num(videoMonthlyRaw)))
      : Math.round(monthlyCredits * 0.2);
  const includedSeats = Math.max(1, Math.round(num(formData.get("includedSeats"), 1)));
  const active = formData.get("active") === "on" || formData.get("active") === "true";
  const pricePerCreditYuan = derivePricePerCredit(priceYuan, monthlyCredits, includedSeats);

  if (!family || !interval || !tier) return { ok: false, error: "类型/周期/档位必填" };
  if (videoMonthlyCredits > monthlyCredits) return { ok: false, error: "视频池积分不能超过月积分" };

  const existingPlans = await prisma.membershipPlan.findMany({
    where: { active: true },
    select: {
      id: true,
      tier: true,
      priceYuan: true,
      monthlyCredits: true,
      includedSeats: true,
      family: true,
    },
  });
  const tierRows = existingPlans
    .filter((p) => p.id !== id)
    .map((p) => ({
      tier: p.tier,
      priceYuan: Number(p.priceYuan),
      monthlyCredits: p.monthlyCredits,
      includedSeats: p.includedSeats,
    }));
  tierRows.push({
    tier,
    priceYuan,
    monthlyCredits,
    includedSeats,
  });
  const refModel = VIDEO_MODEL_SEEDS[0];
  const netCostYuan = refModel.listCostYuan * (1 - refModel.discountRate);
  const sim = simulatePlanChange({
    tiers: tierRows,
    model: {
      canonicalModelKey: refModel.canonicalModelKey,
      netCostYuan,
      units: SCENARIO_LAB_USAGE_SECONDS,
      listPriceYuan: netCostYuan * SCENARIO_LAB_VIDEO_MARGIN_M,
    },
    guard: DEFAULT_VIDEO_MIN_MARGIN_GUARD,
  });
  if (!sim.allPassed) {
    return {
      ok: false,
      error: `套餐毛利护栏未通过（最低 ${(sim.worstMargin * 100).toFixed(1)}%，要求 ≥ ${((DEFAULT_VIDEO_MIN_MARGIN_GUARD - 0.002) * 100).toFixed(1)}% 含容差）。请调整价格或积分后再保存。`,
    };
  }

  const data = {
    family,
    interval,
    tier,
    sortOrder,
    priceYuan,
    originalYuan,
    promoLabel,
    monthlyCredits,
    videoMonthlyCredits,
    pricePerCreditYuan,
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
  const minSeatsRaw = str(formData.get("minSeats"));
  const minSeats = minSeatsRaw ? Math.max(1, Math.round(num(formData.get("minSeats")))) : null;
  const interval = (str(formData.get("interval")) as MembershipInterval) || "MONTH";
  const note = str(formData.get("note")) || null;
  const active = formData.get("active") === "on" || formData.get("active") === "true";
  if (!scopeKey || !label) return { ok: false, error: "规格键与名称必填" };
  const data = { scopeKey, label, techServiceFeeYuan, minSeats, interval, note, active };
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

export async function saveByokQuotaAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const id = str(formData.get("id"));
  const scopeKey = str(formData.get("scopeKey"));
  const taskKind = str(formData.get("taskKind")) as "TEXT_TO_IMAGE" | "IMAGE_TO_VIDEO" | "VIDEO_TO_VIDEO";
  const label = str(formData.get("label"));
  const monthlyIncluded = Math.max(0, Math.round(num(formData.get("monthlyIncluded"))));
  const overageCredits = Math.max(1, Math.round(num(formData.get("overageCredits"))));
  const active = formData.get("active") === "on" || formData.get("active") === "true";
  if (!scopeKey || !taskKind || !label) return { ok: false, error: "规格、任务类型与名称必填" };

  const data = { scopeKey, taskKind, label, monthlyIncluded, overageCredits, active };
  if (id) {
    await prisma.byokTaskQuota.update({ where: { id }, data });
  } else {
    await prisma.byokTaskQuota.upsert({
      where: { scopeKey_taskKind: { scopeKey, taskKind } },
      create: data,
      update: data,
    });
  }
  revalidatePath("/admin/finance/byok");
  return { ok: true };
}
