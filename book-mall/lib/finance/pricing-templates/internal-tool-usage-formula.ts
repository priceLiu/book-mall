/**
 * v002 P2-2：三个「公式型」对内计价模板（token / 按秒 / 按张），与 `internal.tool_usage_v1`
 * 同等地位；写入时同样由 `recordToolUsageAndConsumeWallet` 一次性固化 internal* 列，
 * 这里仅作为「回放路径」：从 cloudRow 上已写入的「对内计价/* 与 用量/* 字段」反推展示。
 *
 * 现阶段（P0+P2-3 已落地，P2-1 实时按公式扣费尚未切流）`recordToolUsageAndConsumeWallet`
 * 仍按 internal.tool_usage_v1 写库；切流到 token/seconds/image 三个 key 由 P2-1 完成。
 */
import type { InternalPricingSnapshot, PricingTemplateModule } from "./types";
import { cloudJsonToRawRow } from "./cloud-row-json";
import {
  PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_IMAGE_V1,
  PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_SECONDS_V1,
  PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_TOKEN_V1,
} from "./keys";

function num(s: string | undefined): number {
  if (s == null) return NaN;
  const n = parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
}

function buildSnapshotFromRow(
  cloudRow: unknown,
  label: string,
  unitName: string,
): InternalPricingSnapshot {
  const row = cloudJsonToRawRow(cloudRow);
  const charged = parseInt(row["对内计价/本行扣点"] || "0", 10);
  const chargedPoints = Number.isFinite(charged) && charged > 0 ? charged : 0;
  const yuan = chargedPoints / 100;

  const cost = num(row["对内计价/云成本单价(元/单位)"]);
  const mult = num(row["对内计价/零售系数"]);
  const ourUnit = num(row["对内计价/我方单价(元/单位)"]);
  const qty = num(row["用量信息/用量"]);
  const unit = row["用量信息/用量单位"] || unitName;

  const costStr = Number.isFinite(cost) && cost > 0 ? cost.toFixed(6) : "0.000000";
  const multStr = Number.isFinite(mult) && mult > 0 ? String(mult) : "0";
  const ourStr =
    Number.isFinite(ourUnit) && ourUnit > 0
      ? ourUnit.toFixed(6)
      : Number.isFinite(cost) && Number.isFinite(mult)
        ? (cost * mult).toFixed(6)
        : "0.000000";

  const persisted = row["对内计价/计价公式与例"]?.trim();
  const formula =
    persisted ||
    `${label}：云成本单价=${costStr} 元/${unit}；系数=${multStr}；` +
      `我方单价=${ourStr} 元/${unit}；用量=${Number.isFinite(qty) ? qty : 0} ${unit}；` +
      `本行扣点=${chargedPoints}（折元 ¥${yuan.toFixed(2)}）`;

  return {
    cloudCostUnitYuan: costStr,
    retailMultiplier: multStr,
    ourUnitYuan: ourStr,
    formulaText: formula,
    chargedPoints,
    yuanReference: yuan.toFixed(4),
  };
}

export const internalToolUsageTokenV1Template: PricingTemplateModule = {
  id: PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_TOKEN_V1,
  label: "工具站使用 · token(internal_token_v1)",
  compute(cloudRow) {
    return buildSnapshotFromRow(cloudRow, this.label, "MTokens");
  },
};

export const internalToolUsageSecondsV1Template: PricingTemplateModule = {
  id: PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_SECONDS_V1,
  label: "工具站使用 · 按秒(internal_seconds_v1)",
  compute(cloudRow) {
    return buildSnapshotFromRow(cloudRow, this.label, "秒");
  },
};

export const internalToolUsageImageV1Template: PricingTemplateModule = {
  id: PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_IMAGE_V1,
  label: "工具站使用 · 按张(internal_image_v1)",
  compute(cloudRow) {
    return buildSnapshotFromRow(cloudRow, this.label, "张");
  },
};
