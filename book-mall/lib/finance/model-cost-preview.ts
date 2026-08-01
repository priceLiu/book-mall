import type { CreditCostUnit } from "@prisma/client";

import {
  canonicalByKey,
  PLATFORM_MEDIA_KIND_LABEL,
} from "@/lib/platform-model/canonical-registry";
import {
  computeCreditPrice,
  computeNetCost,
  marginGuardForUnit,
  marginPassesGuard,
  type PricingConfig,
} from "@/lib/pricing/credit-pricing-formulas";
import { resolveModelMarginM } from "@/lib/pricing/model-margin-policy";

export type ModelCostRowPreview = {
  mediaKind: string | null;
  mediaKindLabel: string | null;
  displayName: string | null;
  marginM: number;
  creditsPerUnit: number;
  listPriceYuan: number;
  marginRate: number;
  marginOk: boolean;
};

export function previewModelCostRow(
  row: {
    canonicalModelKey: string;
    unit: CreditCostUnit | string;
    listCostYuan: number;
    discountRate: number;
  },
  config: PricingConfig,
): ModelCostRowPreview {
  const def = canonicalByKey(row.canonicalModelKey);
  const netCostYuan = computeNetCost(row.listCostYuan, row.discountRate);
  const marginM = resolveModelMarginM({
    unit: row.unit,
    netCostYuan,
    defaultMarginM: config.defaultMarginM,
    videoMarginM: config.videoMarginM,
  });
  const comp = computeCreditPrice({
    listCostYuan: row.listCostYuan,
    discountRate: row.discountRate,
    marginM,
    anchorYuan: config.creditAnchorYuan,
  });
  const minGuard = marginGuardForUnit(row.unit, {
    minMarginGuard: config.minMarginGuard,
    videoMinMarginGuard: config.videoMinMarginGuard,
  });
  return {
    mediaKind: def?.mediaKind ?? null,
    mediaKindLabel: def ? PLATFORM_MEDIA_KIND_LABEL[def.mediaKind] : null,
    displayName: def?.displayName ?? null,
    marginM,
    creditsPerUnit: comp.creditsPerUnit,
    listPriceYuan: comp.listPriceYuan,
    marginRate: comp.baseMarginRate,
    marginOk: marginPassesGuard(comp.baseMarginRate, minGuard),
  };
}
