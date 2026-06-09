/**
 * PricingSourceLine → ModelCostProfile 联动同步。
 */
import type { PricingBillingKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const UNIT_BY_KIND: Partial<Record<PricingBillingKind, "PER_SEC" | "PER_IMAGE" | "PER_KTOKEN">> = {
  VIDEO_MODEL_SPEC: "PER_SEC",
  OUTPUT_IMAGE: "PER_IMAGE",
  COST_PER_IMAGE: "PER_IMAGE",
  TOKEN_IN_OUT: "PER_KTOKEN",
};

export async function syncModelCostFromPricingSource(versionId: string): Promise<{ upserted: number }> {
  const lines = await prisma.pricingSourceLine.findMany({
    where: { versionId, modelKey: { not: "" } },
  });
  let upserted = 0;
  for (const line of lines) {
    const unit = UNIT_BY_KIND[line.billingKind];
    if (!unit) continue;
    const canonicalModelKey = line.modelKey.trim();
    if (!canonicalModelKey) continue;
    let listCostYuan = 0;
    if (line.billingKind === "VIDEO_MODEL_SPEC") {
      const json = line.costJson as Record<string, unknown> | null;
      const flat = json && typeof json.flatYuanPerSecond === "number" ? json.flatYuanPerSecond : null;
      listCostYuan = flat ?? 0;
    } else if (line.billingKind === "OUTPUT_IMAGE" || line.billingKind === "COST_PER_IMAGE") {
      const json = line.costJson as Record<string, unknown> | null;
      const v = json && typeof json.pricePerImageYuan === "number" ? json.pricePerImageYuan : null;
      listCostYuan = v ?? 0;
    } else if (line.outputYuanPerMillion != null) {
      listCostYuan = Number(line.outputYuanPerMillion) / 1_000_000;
    }
    if (!(listCostYuan > 0)) continue;
    const discountRate = Number(line.effectiveDiscount ?? 0);
    const netCostYuan = listCostYuan * (1 - Math.min(1, Math.max(0, discountRate)));
    const id = `sync-${canonicalModelKey}-${line.tierRaw ?? "default"}-CHANNEL`;
    await prisma.modelCostProfile.upsert({
      where: { id },
      create: {
        id,
        vendor: "aliyun",
        canonicalModelKey,
        channel: "CHANNEL",
        unit,
        tierRaw: line.tierRaw,
        listCostYuan,
        discountRate,
        netCostYuan,
        active: true,
        note: `sync from PricingSourceLine ${line.id}`,
      },
      update: {
        listCostYuan,
        discountRate,
        netCostYuan,
        active: true,
        note: `sync from PricingSourceLine ${line.id}`,
      },
    });
    upserted += 1;
  }
  return { upserted };
}
