import { prisma } from "@/lib/prisma";

export type PricingEstimate = {
  pricingModelKey: string | null;
  pricingTierRaw: string | null;
  billingKind: string | null;
  vendorListUnitCostYuan: number | null;
  estimatedVendorCostYuan: number | null;
};

/** 只读 B 表挂牌价，用于 BYOK 日志展示（不扣 wallet） */
export async function estimateVendorCost(opts: {
  modelKey: string;
  promptTokens?: number;
  completionTokens?: number;
  tierRaw?: string;
  durationSec?: number;
  requestKind?: string;
}): Promise<PricingEstimate> {
  const empty: PricingEstimate = {
    pricingModelKey: null,
    pricingTierRaw: null,
    billingKind: null,
    vendorListUnitCostYuan: null,
    estimatedVendorCostYuan: null,
  };

  const version = await prisma.pricingSourceVersion.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });
  if (!version) return empty;

  const modelKey = opts.modelKey.trim();
  const tierRaw = opts.tierRaw?.trim();
  const modelMatch = [
    { modelKey: { equals: modelKey, mode: "insensitive" as const } },
    { modelLabelRaw: { contains: modelKey, mode: "insensitive" as const } },
  ];
  let line =
    tierRaw != null && tierRaw !== ""
      ? await prisma.pricingSourceLine.findFirst({
          where: {
            versionId: version.id,
            tierRaw,
            OR: modelMatch,
          },
        })
      : null;
  if (!line) {
    line = await prisma.pricingSourceLine.findFirst({
      where: { versionId: version.id, OR: modelMatch },
    });
  }
  if (!line) return { ...empty, pricingModelKey: modelKey };

  const billingKind = line.billingKind;
  let estimated: number | null = null;
  let unitCost: number | null = null;

  if (billingKind === "TOKEN_IN_OUT") {
    const inY = line.inputYuanPerMillion ?? 0;
    const outY = line.outputYuanPerMillion ?? 0;
    const pt = opts.promptTokens ?? 0;
    const ct = opts.completionTokens ?? 0;
    if (pt || ct) {
      estimated = (pt / 1e6) * inY + (ct / 1e6) * outY;
    }
    unitCost = inY || outY || null;
  } else if (
    billingKind === "VIDEO_MODEL_SPEC" ||
    opts.requestKind === "VIDEO"
  ) {
    const costJson = line.costJson as Record<string, unknown> | null;
    const flat =
      typeof costJson?.flatYuanPerSecond === "number"
        ? costJson.flatYuanPerSecond
        : null;
    unitCost = flat;
    const sec = opts.durationSec ?? 5;
    if (flat != null) estimated = flat * sec;
  } else {
    const costJson = line.costJson as Record<string, unknown> | null;
    const perImage =
      typeof costJson?.perImageYuan === "number" ? costJson.perImageYuan : null;
    unitCost = perImage;
    if (perImage != null) estimated = perImage;
  }

  return {
    pricingModelKey: line.modelKey,
    pricingTierRaw: opts.tierRaw ?? line.tierRaw,
    billingKind,
    vendorListUnitCostYuan: unitCost,
    estimatedVendorCostYuan: estimated,
  };
}
