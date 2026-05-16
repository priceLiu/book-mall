import type { InternalPricingSnapshot, PricingTemplateModule } from "./types";
import { cloudJsonToRawRow } from "./cloud-row-json";

/**
 * 「工具站内部使用」对内计价模板（与云对账的 `aliyun.consumedetail_bill_v2` 同等地位）。
 *
 * v002（2026-05-16）变更：`compute(cloudRow)` 优先从 cloudRow 反推已经固化的
 * `对内计价/云成本单价(元/单位)`、`对内计价/零售系数`、`对内计价/我方单价(元/单位)`、`对内计价/本行扣点`；
 * 三者缺失时（旧行/兜底）才退回到「点数直扣」展示（云成本单价/系数仍标空，便于一眼看出缺快照）。
 *
 * 适用：`ToolBillingDetailLine.source = TOOL_USAGE_GENERATED`，由 `recordToolUsageAndConsumeWallet`
 * 在用户每次成功扣费的同事务里写入，且 `internal*` 列在写入时已固化；本 compute 仅作为
 * `enrichBillingLineToFlatRow` 在 `internalChargedPoints` 为 null 的极端情况下的回放兜底。
 */
function parseDecimalLoose(raw: string | undefined): number {
  if (raw == null) return NaN;
  const n = parseFloat(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
}

export const internalToolUsageV1Template: PricingTemplateModule = {
  id: "internal.tool_usage_v1",
  label: "工具站使用 · 按公式快照",
  compute(cloudRow: unknown): InternalPricingSnapshot {
    const row = cloudJsonToRawRow(cloudRow);
    const charged = parseInt(row["对内计价/本行扣点"] || "0", 10);
    const chargedPoints = Number.isFinite(charged) && charged > 0 ? charged : 0;
    const yuan = chargedPoints / 100;

    const costRaw = parseDecimalLoose(row["对内计价/云成本单价(元/单位)"]);
    const multRaw = parseDecimalLoose(row["对内计价/零售系数"]);
    const ourRaw = parseDecimalLoose(row["对内计价/我方单价(元/单位)"]);

    const hasCost = Number.isFinite(costRaw) && costRaw > 0;
    const hasMult = Number.isFinite(multRaw) && multRaw > 0;
    const hasOur = Number.isFinite(ourRaw) && ourRaw > 0;

    const cost = hasCost ? costRaw : 0;
    const mult = hasMult ? multRaw : 0;
    const ourUnit = hasOur ? ourRaw : cost * mult;

    const qtyRaw = parseDecimalLoose(row["用量信息/用量"]);
    const qty = Number.isFinite(qtyRaw) ? qtyRaw : 0;
    const unit = row["用量信息/用量单位"] || "次";

    const formulaPersisted = row["对内计价/计价公式与例"]?.trim();
    const formula =
      formulaPersisted ||
      (hasCost || hasMult
        ? `云成本单价=${cost.toFixed(6)} 元/${unit}；系数=${mult || "?"}；我方单价=${ourUnit.toFixed(6)} 元/${unit}；用量=${qty} ${unit}；本行扣点=${chargedPoints}（折元 ¥${yuan.toFixed(2)}）；模板=${internalToolUsageV1Template.label}`
        : `本行扣点=${chargedPoints}（折元 ¥${yuan.toFixed(2)}）；缺少 cost/系数快照，回放仅展示扣点；模板=${internalToolUsageV1Template.label}`);

    return {
      cloudCostUnitYuan: cost.toFixed(6),
      retailMultiplier: mult ? String(mult) : "0",
      ourUnitYuan: ourUnit.toFixed(6),
      formulaText: formula,
      chargedPoints,
      yuanReference: yuan.toFixed(4),
    };
  },
};
