import type { AppModelOfferingStatus, GatewayProviderKind, ModelMediaKind } from "@prisma/client";

import {
  computeCreditPrice,
  loadPricingConfig,
  marginGuardForUnit,
  marginPassesGuard,
  publishModelCreditPrice,
  resolveModelMarginM,
} from "@/lib/pricing/credit-pricing-engine";
import { prisma } from "@/lib/prisma";
import {
  GATEWAY_CANONICAL_REGISTRY,
  PLATFORM_MEDIA_KIND_LABEL,
  canonicalByKey,
  type CanonicalRouteDef,
} from "@/lib/platform-model/canonical-registry";
import {
  buildProfileLookup,
  enrichCandidateFromProfile,
  finalizeEnrichedCandidates,
  resolveCostCanonicalKey,
  summarizeOfferingRecommendation,
  type EnrichedOfferingCandidate,
  type OfferingCandidateInput,
} from "@/lib/platform-model/offering-candidate-preview";

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

export type PlatformOfferingCandidateRow = EnrichedOfferingCandidate;

export type PlatformOfferingAdminRow = {
  id: string;
  canonicalModelKey: string;
  mediaKind: ModelMediaKind | null;
  mediaKindLabel: string | null;
  role: string;
  displayName: string;
  status: AppModelOfferingStatus;
  routeLocked: boolean;
  activeVendor: string | null;
  activeCanonicalKey: string | null;
  activeProviderKind: string | null;
  activeModelKey: string | null;
  publishedCreditsPerUnit: number | null;
  estimatedMargin: number | null;
  marginWarning: boolean;
  appTags: string[];
  candidates: PlatformOfferingCandidateRow[];
  registered: boolean;
  recommendedCandidateId: string | null;
  recommendedVendor: string | null;
  recommendedModelKey: string | null;
  recommendedNetCostYuan: number | null;
  recommendedUnitLabel: string | null;
  activeMatchesRecommended: boolean;
  activeNetCostYuan: number | null;
  activeUnitLabel: string | null;
};

function enrichOfferingCandidates(
  inputs: OfferingCandidateInput[],
  profileLookup: ReturnType<typeof buildProfileLookup>,
  config: Awaited<ReturnType<typeof loadPricingConfig>>,
): PlatformOfferingCandidateRow[] {
  const enriched = inputs.map((c) =>
    enrichCandidateFromProfile(
      c,
      profileLookup.get(`${resolveCostCanonicalKey(c.canonicalModelKey)}|${c.vendor}`),
      config,
    ),
  );
  return finalizeEnrichedCandidates(enriched);
}

function buildRegistryCandidates(
  canonicalModelKey: string,
  routes: CanonicalRouteDef[],
): OfferingCandidateInput[] {
  return routes.map((c, i) => ({
    id: `registry:${canonicalModelKey}:${i}`,
    vendor: c.vendor,
    canonicalModelKey,
    modelKey: c.modelKey,
    providerKind: c.providerKind,
    isActiveRoute: false,
  }));
}

export async function listPlatformOfferingsForAdmin(): Promise<PlatformOfferingAdminRow[]> {
  const [rows, catalogs, config] = await Promise.all([
    prisma.appModelOffering.findMany({
      where: { status: { not: "DEPRECATED" } },
      include: {
        candidates: { orderBy: [{ isActiveRoute: "desc" }, { netCostYuan: "asc" }] },
      },
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
    }),
    prisma.modelCatalog.findMany({
      where: { gatewayPublished: true },
      select: {
        canonicalKey: true,
        mediaKind: true,
        appTags: true,
      },
    }),
    loadPricingConfig(),
  ]);

  const costCanonicalKeys = new Set<string>();
  for (const def of GATEWAY_CANONICAL_REGISTRY) {
    costCanonicalKeys.add(resolveCostCanonicalKey(def.canonicalModelKey));
  }

  const profiles = await prisma.modelCostProfile.findMany({
    where: {
      canonicalModelKey: { in: [...costCanonicalKeys] },
      active: true,
    },
  });
  const profileLookup = buildProfileLookup(profiles);

  const catalogMap = new Map(catalogs.map((c) => [c.canonicalKey, c]));
  const registryKeys = new Set(GATEWAY_CANONICAL_REGISTRY.map((c) => c.canonicalModelKey));

  const mapped: PlatformOfferingAdminRow[] = rows.map((r) => {
    const cat = catalogMap.get(r.canonicalModelKey);
    const def = canonicalByKey(r.canonicalModelKey);
    const mediaKind = cat?.mediaKind ?? def?.mediaKind ?? null;
    const estimatedMargin = r.estimatedMargin != null ? toNum(r.estimatedMargin) : null;

    const candidateInputs: OfferingCandidateInput[] = r.candidates
      .filter((c) => c.canonicalModelKey === r.canonicalModelKey)
      .map((c) => ({
        id: c.id,
        vendor: c.vendor,
        canonicalModelKey: c.canonicalModelKey,
        modelKey: c.modelKey,
        providerKind: c.providerKind,
        isActiveRoute: c.isActiveRoute,
      }));

    const candidates = enrichOfferingCandidates(candidateInputs, profileLookup, config);
    const activeCandidate = candidates.find((c) => c.isActiveRoute);
    const rec = summarizeOfferingRecommendation(candidates);

    return {
      id: r.id,
      canonicalModelKey: r.canonicalModelKey,
      mediaKind,
      mediaKindLabel: mediaKind ? PLATFORM_MEDIA_KIND_LABEL[mediaKind] : null,
      role: r.role,
      displayName: r.displayName,
      status: r.status,
      routeLocked: r.routeLocked,
      activeVendor: activeCandidate?.vendor ?? r.activeVendor,
      activeCanonicalKey: r.activeCanonicalKey,
      activeProviderKind: r.activeProviderKind as GatewayProviderKind | null,
      activeModelKey: r.activeModelKey,
      publishedCreditsPerUnit: r.publishedCreditsPerUnit,
      estimatedMargin,
      marginWarning: r.status === "DRAFT" || (estimatedMargin != null && estimatedMargin < 0.5),
      appTags: cat?.appTags ?? def?.appTags ?? [],
      candidates,
      registered: registryKeys.has(r.canonicalModelKey),
      ...rec,
    };
  });

  for (const def of GATEWAY_CANONICAL_REGISTRY) {
    if (mapped.some((m) => m.canonicalModelKey === def.canonicalModelKey)) continue;

    const candidateInputs = buildRegistryCandidates(def.canonicalModelKey, def.routes);
    const candidates = enrichOfferingCandidates(candidateInputs, profileLookup, config);
    const rec = summarizeOfferingRecommendation(candidates);

    mapped.push({
      id: `registry:${def.canonicalModelKey}`,
      canonicalModelKey: def.canonicalModelKey,
      mediaKind: def.mediaKind,
      mediaKindLabel: PLATFORM_MEDIA_KIND_LABEL[def.mediaKind],
      role: def.role,
      displayName: def.displayName,
      status: "DRAFT",
      routeLocked: false,
      activeVendor: null,
      activeCanonicalKey: null,
      activeProviderKind: null,
      activeModelKey: null,
      publishedCreditsPerUnit: null,
      estimatedMargin: null,
      marginWarning: true,
      appTags: def.appTags,
      candidates,
      registered: true,
      ...rec,
    });
  }

  return mapped.sort((a, b) => {
    const defA = canonicalByKey(a.canonicalModelKey);
    const defB = canonicalByKey(b.canonicalModelKey);
    const ma = a.mediaKind ?? "";
    const mb = b.mediaKind ?? "";
    if (ma !== mb) return ma.localeCompare(mb);
    return (defA?.sortOrder ?? 0) - (defB?.sortOrder ?? 0);
  });
}

/** 手动切换同 canonical 下的厂商路由（会锁定并刷新上架字段）。 */
export async function setPlatformOfferingActiveCandidate(input: {
  offeringId: string;
  candidateId: string;
  actorUserId: string;
}) {
  if (input.offeringId.startsWith("registry:")) {
    throw new Error("该模型尚未上架，请先同步自动上架");
  }

  const candidate = await prisma.appModelCandidate.findFirst({
    where: { id: input.candidateId, offeringId: input.offeringId },
  });
  if (!candidate) throw new Error("候选厂商不存在");
  if (!candidate.marginOk) {
    throw new Error("该候选毛利不达标，请先在「模型成本」调整成本或在「积分报价」调整系数");
  }

  const offering = await prisma.appModelOffering.findUnique({
    where: { id: input.offeringId },
  });
  if (!offering) throw new Error("模型不存在");

  if (candidate.canonicalModelKey !== offering.canonicalModelKey) {
    throw new Error("候选必须与上架模型为同一 canonical");
  }

  const costKey = resolveCostCanonicalKey(candidate.canonicalModelKey);
  const profile = await prisma.modelCostProfile.findFirst({
    where: {
      canonicalModelKey: costKey,
      vendor: candidate.vendor,
      active: true,
    },
    orderBy: { netCostYuan: "asc" },
  });
  if (!profile) {
    throw new Error(`未找到 ${candidate.vendor}/${costKey} 的有效成本档`);
  }

  const config = await loadPricingConfig();
  const netCostYuan = toNum(profile.netCostYuan);
  const comp = computeCreditPrice({
    listCostYuan: toNum(profile.listCostYuan),
    discountRate: toNum(profile.discountRate),
    marginM: resolveModelMarginM({
      unit: profile.unit,
      netCostYuan,
      defaultMarginM: config.defaultMarginM,
      videoMarginM: config.videoMarginM,
    }),
    anchorYuan: config.creditAnchorYuan,
  });
  if (!marginPassesGuard(comp.baseMarginRate, marginGuardForUnit(profile.unit, config))) {
    throw new Error("该候选当前毛利仍低于护栏，无法切换");
  }

  await publishModelCreditPrice({
    canonicalModelKey: costKey,
    displayName: offering.displayName,
    publishedBy: input.actorUserId,
  });

  await prisma.$transaction([
    prisma.appModelCandidate.updateMany({
      where: { offeringId: input.offeringId },
      data: { isActiveRoute: false },
    }),
    prisma.appModelCandidate.update({
      where: { id: candidate.id },
      data: { isActiveRoute: true },
    }),
    prisma.appModelOffering.update({
      where: { id: input.offeringId },
      data: {
        routeLocked: true,
        status: "ACTIVE",
        activeCanonicalKey: candidate.canonicalModelKey,
        activeVendor: candidate.vendor,
        activeProviderKind: candidate.providerKind,
        activeModelKey: candidate.modelKey,
        publishedCreditsPerUnit: comp.creditsPerUnit,
        estimatedMargin: comp.baseMarginRate,
      },
    }),
    prisma.offeringPublishLog.create({
      data: {
        offeringId: input.offeringId,
        action: "MANUAL_ROUTE",
        toCanonicalKey: candidate.canonicalModelKey,
        toProviderKind: candidate.providerKind,
        netCostYuan: toNum(candidate.netCostYuan),
        estimatedMargin: comp.baseMarginRate,
        publishedBy: input.actorUserId,
        note: `${candidate.vendor} · ${candidate.modelKey}`,
      },
    }),
  ]);

  return { ok: true as const };
}

export async function setPlatformOfferingRouteLocked(input: {
  offeringId: string;
  routeLocked: boolean;
  actorUserId: string;
}) {
  if (input.offeringId.startsWith("registry:")) {
    throw new Error("该模型尚未上架，请先同步自动上架");
  }
  const row = await prisma.appModelOffering.update({
    where: { id: input.offeringId },
    data: { routeLocked: input.routeLocked },
  });
  await prisma.offeringPublishLog.create({
    data: {
      offeringId: row.id,
      action: input.routeLocked ? "MANUAL_LOCK" : "MANUAL_UNLOCK",
      publishedBy: input.actorUserId,
      note: input.routeLocked ? "财务锁定路由" : "解除锁定",
    },
  });
  return row;
}
