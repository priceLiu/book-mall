import type { CreditCostUnit, GatewayProviderKind } from "@prisma/client";

import { previewModelCostRow } from "@/lib/finance/model-cost-preview";
import type { PricingConfig } from "@/lib/pricing/credit-pricing-formulas";
import { computeNetCost } from "@/lib/pricing/credit-pricing-formulas";
import { canonicalByKey } from "@/lib/platform-model/canonical-registry";

export type CostProfileLike = {
  canonicalModelKey: string;
  vendor: string;
  unit: CreditCostUnit;
  listCostYuan: unknown;
  discountRate: unknown;
  netCostYuan: unknown;
};

export type OfferingCandidateInput = {
  id: string;
  vendor: string;
  canonicalModelKey: string;
  modelKey: string;
  providerKind?: GatewayProviderKind;
  isActiveRoute: boolean;
};

export type EnrichedOfferingCandidate = OfferingCandidateInput & {
  listCostYuan: number;
  netCostYuan: number;
  unit: CreditCostUnit | null;
  unitLabel: string | null;
  creditsPerUnit: number | null;
  marginRate: number | null;
  marginOk: boolean;
  costMissing: boolean;
  isRecommended: boolean;
};

const UNIT_LABEL: Record<CreditCostUnit, string> = {
  PER_SEC: "元/秒",
  PER_IMAGE: "元/张",
  PER_KTOKEN: "元/千 tokens",
};

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

/** 查成本档用的 canonical（与 auto-publish 一致）。 */
export function resolveCostCanonicalKey(canonicalModelKey: string): string {
  return canonicalModelKey === "lib-nano-pro" ? "lib-nano-pro-2k" : canonicalModelKey;
}

export function unitLabelFor(
  unit: CreditCostUnit | null | undefined,
  canonicalModelKey: string,
): string | null {
  const def = canonicalByKey(canonicalModelKey);
  if (def?.unitLabel) return def.unitLabel;
  if (unit && UNIT_LABEL[unit]) return UNIT_LABEL[unit];
  return null;
}

function profileLookupKey(canonicalModelKey: string, vendor: string): string {
  return `${resolveCostCanonicalKey(canonicalModelKey)}|${vendor}`;
}

/** 批量构建 profile lookup：canonicalKey|vendor → 最低 netCost 的 active profile。 */
export function buildProfileLookup(
  profiles: CostProfileLike[],
): Map<string, CostProfileLike> {
  const map = new Map<string, CostProfileLike>();
  for (const p of profiles) {
    const key = profileLookupKey(p.canonicalModelKey, p.vendor);
    const existing = map.get(key);
    if (!existing || toNum(p.netCostYuan) < toNum(existing.netCostYuan)) {
      map.set(key, p);
    }
  }
  return map;
}

export function enrichCandidateFromProfile(
  candidate: OfferingCandidateInput,
  profile: CostProfileLike | undefined,
  config: PricingConfig,
): EnrichedOfferingCandidate {
  if (!profile) {
    return {
      ...candidate,
      listCostYuan: 0,
      netCostYuan: 0,
      unit: null,
      unitLabel: unitLabelFor(null, candidate.canonicalModelKey),
      creditsPerUnit: null,
      marginRate: null,
      marginOk: false,
      costMissing: true,
      isRecommended: false,
    };
  }

  const listCostYuan = toNum(profile.listCostYuan);
  const discountRate = toNum(profile.discountRate);
  const netCostYuan = toNum(profile.netCostYuan) || computeNetCost(listCostYuan, discountRate);
  const preview = previewModelCostRow(
    {
      canonicalModelKey: profile.canonicalModelKey,
      unit: profile.unit,
      listCostYuan,
      discountRate,
    },
    config,
  );

  return {
    ...candidate,
    listCostYuan,
    netCostYuan,
    unit: profile.unit,
    unitLabel: unitLabelFor(profile.unit, candidate.canonicalModelKey),
    creditsPerUnit: preview.creditsPerUnit,
    marginRate: preview.marginRate,
    marginOk: preview.marginOk,
    costMissing: false,
    isRecommended: false,
  };
}

export function pickRecommendedCandidateId(
  candidates: Array<Pick<EnrichedOfferingCandidate, "id" | "marginOk" | "netCostYuan" | "costMissing">>,
): string | null {
  const eligible = candidates.filter((c) => c.marginOk && !c.costMissing);
  if (eligible.length === 0) return null;
  let best = eligible[0]!;
  for (const c of eligible) {
    if (c.netCostYuan < best.netCostYuan) best = c;
  }
  return best.id;
}

/** 标记 isRecommended 并排序：推荐 first → netCost 升序。 */
export function finalizeEnrichedCandidates(
  candidates: EnrichedOfferingCandidate[],
): EnrichedOfferingCandidate[] {
  const recommendedId = pickRecommendedCandidateId(candidates);
  const marked = candidates.map((c) => ({
    ...c,
    isRecommended: c.id === recommendedId,
  }));
  return marked.sort((a, b) => {
    if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1;
    if (a.costMissing !== b.costMissing) return a.costMissing ? 1 : -1;
    return a.netCostYuan - b.netCostYuan;
  });
}

export type OfferingRecommendationSummary = {
  recommendedCandidateId: string | null;
  recommendedVendor: string | null;
  recommendedModelKey: string | null;
  recommendedNetCostYuan: number | null;
  recommendedUnitLabel: string | null;
  activeMatchesRecommended: boolean;
  activeNetCostYuan: number | null;
  activeUnitLabel: string | null;
};

export function summarizeOfferingRecommendation(
  candidates: EnrichedOfferingCandidate[],
): OfferingRecommendationSummary {
  const recommended = candidates.find((c) => c.isRecommended) ?? null;
  const active = candidates.find((c) => c.isActiveRoute) ?? null;
  return {
    recommendedCandidateId: recommended?.id ?? null,
    recommendedVendor: recommended?.vendor ?? null,
    recommendedModelKey: recommended?.modelKey ?? null,
    recommendedNetCostYuan: recommended?.netCostYuan ?? null,
    recommendedUnitLabel: recommended?.unitLabel ?? null,
    activeMatchesRecommended:
      recommended != null && active != null && recommended.id === active.id,
    activeNetCostYuan: active?.netCostYuan ?? null,
    activeUnitLabel: active?.unitLabel ?? null,
  };
}
