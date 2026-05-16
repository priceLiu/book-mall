import { Prisma } from "@prisma/client";
import { ALL_DISPLAY_KEYS } from "@/lib/finance/bill-display-keys";
import { cloudJsonToRawRow } from "@/lib/finance/pricing-templates/cloud-row-json";
import type { RawBillRow } from "@/lib/finance/pricing-templates/cloud-row-json";
import {
  computeInternalPricingWithTemplate,
  getPricingTemplate,
  type InternalPricingSnapshot,
} from "@/lib/finance/pricing-templates/registry";
import { DEFAULT_PRICING_TEMPLATE_KEY } from "@/lib/finance/pricing-templates/keys";

export type { InternalPricingSnapshot } from "@/lib/finance/pricing-templates/registry";
export { cloudJsonToRawRow } from "@/lib/finance/pricing-templates/cloud-row-json";

/** @deprecated 请使用 `computeInternalPricingWithTemplate(cloudRow, templateKey)`；此为阿里云默认模板兼容别名 */
export function computeInternalPricingFromCloudRow(cloudRow: unknown): InternalPricingSnapshot {
  return computeInternalPricingWithTemplate(cloudRow, DEFAULT_PRICING_TEMPLATE_KEY);
}

export { computeInternalPricingWithTemplate } from "@/lib/finance/pricing-templates/registry";

const K_PLATFORM_TEMPLATE = "平台信息/计价模板";

function decimalToFixed(v: Prisma.Decimal | null | undefined, digits: number): string {
  if (v == null) return (0).toFixed(digits);
  return v.toFixed(digits);
}

/** 从持久化列还原快照；internalChargedPoints 为空视为历史未固化 */
export function internalPricingSnapshotFromLine(line: {
  internalCloudCostUnitYuan: Prisma.Decimal | null;
  internalRetailMultiplier: Prisma.Decimal | null;
  internalOurUnitYuan: Prisma.Decimal | null;
  internalFormulaText: string | null;
  internalChargedPoints: number | null;
  internalYuanReference: Prisma.Decimal | null;
}): InternalPricingSnapshot | null {
  if (line.internalChargedPoints == null) return null;
  return {
    cloudCostUnitYuan: decimalToFixed(line.internalCloudCostUnitYuan, 6),
    retailMultiplier:
      line.internalRetailMultiplier != null
        ? line.internalRetailMultiplier.toString()
        : "0",
    ourUnitYuan: decimalToFixed(line.internalOurUnitYuan, 6),
    formulaText: line.internalFormulaText ?? "",
    chargedPoints: line.internalChargedPoints,
    yuanReference: decimalToFixed(line.internalYuanReference, 4),
  };
}

export function prismaDataFromInternalSnapshot(
  snap: InternalPricingSnapshot,
  capturedAt: Date,
) {
  return {
    internalCloudCostUnitYuan: new Prisma.Decimal(snap.cloudCostUnitYuan),
    internalRetailMultiplier: new Prisma.Decimal(snap.retailMultiplier),
    internalOurUnitYuan: new Prisma.Decimal(snap.ourUnitYuan),
    internalFormulaText: snap.formulaText,
    internalChargedPoints: snap.chargedPoints,
    internalYuanReference: new Prisma.Decimal(snap.yuanReference),
    internalCapturedAt: capturedAt,
  };
}

/**
 * 合并云快照 + 平台用户 + 对内计价列 + 计价模板展示链。
 * `persisted` 非空时使用库内快照；为空时按 `templateKey` 调用已注册模板计算。
 */
export function enrichCloudRowToFlat(
  cloudRow: unknown,
  platformUserId: string,
  platformUserLabel: string,
  persisted: InternalPricingSnapshot | null,
  templateKey: string,
): Record<string, string> {
  const row = cloudJsonToRawRow(cloudRow);
  const key = templateKey?.trim() || DEFAULT_PRICING_TEMPLATE_KEY;
  const snap = persisted ?? computeInternalPricingWithTemplate(cloudRow, key);
  const tmpl = getPricingTemplate(key);

  const enriched: RawBillRow = {
    ...row,
    "平台信息/用户ID": platformUserId,
    "平台信息/用户昵称": platformUserLabel,
    [K_PLATFORM_TEMPLATE]: tmpl.label,
    "对内计价/云成本单价(元/单位)": snap.cloudCostUnitYuan,
    "对内计价/零售系数": snap.retailMultiplier,
    "对内计价/我方单价(元/单位)": snap.ourUnitYuan,
    "对内计价/计价公式与例": snap.formulaText,
    "对内计价/本行扣点": String(snap.chargedPoints),
    "对内计价/折元参考(¥)": snap.yuanReference,
  };

  const out: Record<string, string> = {};
  for (const k of ALL_DISPLAY_KEYS) {
    out[k] = enriched[k] ?? "";
  }
  return out;
}

export function enrichBillingLineToFlatRow(
  line: {
    cloudRow: unknown;
    pricingTemplateKey: string;
    internalCloudCostUnitYuan: Prisma.Decimal | null;
    internalRetailMultiplier: Prisma.Decimal | null;
    internalOurUnitYuan: Prisma.Decimal | null;
    internalFormulaText: string | null;
    internalChargedPoints: number | null;
    internalYuanReference: Prisma.Decimal | null;
  },
  platformUserId: string,
  platformUserLabel: string,
): Record<string, string> {
  const key = line.pricingTemplateKey?.trim() || DEFAULT_PRICING_TEMPLATE_KEY;
  const persisted = internalPricingSnapshotFromLine(line);
  return enrichCloudRowToFlat(line.cloudRow, platformUserId, platformUserLabel, persisted, key);
}
