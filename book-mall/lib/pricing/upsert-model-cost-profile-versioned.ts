/**
 * ModelCostProfile 关旧开新：调价时保留历史档，仅启用新档。
 */
import { CreditChannel, CreditCostUnit, type Prisma } from "@prisma/client";

import { computeNetCost } from "@/lib/pricing/credit-pricing-formulas";
import { prisma } from "@/lib/prisma";

export type VersionedCostProfileInput = {
  vendor: string;
  canonicalModelKey: string;
  channel: CreditChannel;
  unit: CreditCostUnit;
  tierRaw?: string | null;
  credentialId?: string | null;
  listCostYuan: number;
  inputListCostYuan?: number | null;
  outputListCostYuan?: number | null;
  discountRate: number;
  note?: string | null;
  /** 首次 seed 可用固定 id；后续调价一律新 cuid */
  seedId?: string;
};

export type VersionedCostProfileResult = {
  action: "unchanged" | "created" | "versioned";
  profileId: string;
  closedProfileId?: string;
};

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

function tierMatch(tierRaw: string | null | undefined) {
  const t = tierRaw?.trim();
  return t ? { tierRaw: t } : { tierRaw: null };
}

function profileIdentityWhere(input: VersionedCostProfileInput): Prisma.ModelCostProfileWhereInput {
  return {
    vendor: input.vendor,
    canonicalModelKey: input.canonicalModelKey,
    channel: input.channel,
    unit: input.unit,
    ...tierMatch(input.tierRaw),
    active: true,
    effectiveTo: null,
  };
}

function pricesEqual(
  existing: {
    listCostYuan: unknown;
    inputListCostYuan: unknown;
    outputListCostYuan: unknown;
    discountRate: unknown;
    unit: CreditCostUnit;
  },
  input: VersionedCostProfileInput,
): boolean {
  if (existing.unit !== input.unit) return false;
  if (round8(num(existing.discountRate)) !== round8(input.discountRate)) return false;
  if (round8(num(existing.listCostYuan)) !== round8(input.listCostYuan)) return false;
  const inA = existing.inputListCostYuan != null ? round8(num(existing.inputListCostYuan)) : null;
  const inB = input.inputListCostYuan != null ? round8(num(input.inputListCostYuan)) : null;
  const outA = existing.outputListCostYuan != null ? round8(num(existing.outputListCostYuan)) : null;
  const outB = input.outputListCostYuan != null ? round8(num(input.outputListCostYuan)) : null;
  return inA === inB && outA === outB;
}

function buildCreateData(
  input: VersionedCostProfileInput,
  id: string,
  effectiveFrom: Date,
): Prisma.ModelCostProfileCreateInput {
  const netCostYuan = computeNetCost(input.listCostYuan, input.discountRate);
  return {
    id,
    vendor: input.vendor,
    canonicalModelKey: input.canonicalModelKey,
    channel: input.channel,
    credentialId: input.credentialId ?? null,
    unit: input.unit,
    tierRaw: input.tierRaw?.trim() || null,
    listCostYuan: input.listCostYuan,
    inputListCostYuan: input.inputListCostYuan ?? null,
    outputListCostYuan: input.outputListCostYuan ?? null,
    discountRate: input.discountRate,
    netCostYuan,
    active: true,
    effectiveFrom,
    effectiveTo: null,
    note: input.note ?? null,
  };
}

/**
 * 同档同价 → 跳过；同档不同价 → 旧档 effectiveTo=now + active=false，新建一条。
 */
export async function upsertModelCostProfileVersioned(
  input: VersionedCostProfileInput,
): Promise<VersionedCostProfileResult> {
  if (!input.vendor.trim()) {
    throw new Error(`成本档 vendor 不能为空：${input.canonicalModelKey}`);
  }
  if (!(input.listCostYuan > 0)) {
    throw new Error(`成本档 listCostYuan 须 > 0：${input.canonicalModelKey}`);
  }

  const now = new Date();
  const existing = await prisma.modelCostProfile.findFirst({
    where: profileIdentityWhere(input),
    orderBy: { effectiveFrom: "desc" },
  });

  if (existing && pricesEqual(existing, input)) {
    return { action: "unchanged", profileId: existing.id };
  }

  if (existing) {
    await prisma.modelCostProfile.update({
      where: { id: existing.id },
      data: {
        effectiveTo: now,
        active: false,
        note: existing.note
          ? `${existing.note} · closed ${now.toISOString().slice(0, 10)}`
          : `closed ${now.toISOString().slice(0, 10)}`,
      },
    });
    const created = await prisma.modelCostProfile.create({
      data: buildCreateData(input, crypto.randomUUID(), now),
    });
    return { action: "versioned", profileId: created.id, closedProfileId: existing.id };
  }

  const id = input.seedId?.trim() || crypto.randomUUID();
  const created = await prisma.modelCostProfile.create({
    data: buildCreateData(input, id, now),
  });
  return { action: "created", profileId: created.id };
}

/** 停用脏档（如对账误同步的空 vendor / 异常单价） */
export async function deactivateModelCostProfile(
  id: string,
  reason: string,
): Promise<void> {
  const now = new Date();
  await prisma.modelCostProfile.update({
    where: { id },
    data: {
      active: false,
      effectiveTo: now,
      note: reason,
    },
  });
}
