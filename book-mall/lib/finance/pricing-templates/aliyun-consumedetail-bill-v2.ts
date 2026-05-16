import type { InternalPricingSnapshot, PricingTemplateModule } from "./types";
import { cloudJsonToRawRow } from "./cloud-row-json";
import type { RawBillRow } from "./cloud-row-json";

function parseNum(s: string | undefined): number {
  if (s == null || s === "") return 0;
  const n = parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** 阿里云 consumedetailbillv2 常见列：有效云成本单价（元/单位）推导 */
function pickUnitCostYuan(row: RawBillRow, qty: number): number {
  const list = parseNum(row["定价信息/官网目录价"]);
  const afterDisc = parseNum(row["优惠信息/优惠后金额"]);
  const payable = parseNum(row["应付信息/应付金额（含税）"]);

  if (qty > 0 && afterDisc > 0) return afterDisc / qty;
  if (qty > 0 && payable > 0) return payable / qty;
  if (qty > 0 && list > 0) return list;
  if (qty <= 0 && list > 0) return list;
  return 0;
}

/** 当前对内零售系数（阿里云模板）；其它厂商可在各自模板内单独定义 */
export const ALIYUN_CONSUMEDETAIL_RETAIL_MULTIPLIER = 2;

/**
 * 阿里云「明细账单 consumedetailbill_v2」对内计价模板。
 * 后续腾讯云 / AWS 等请新增独立 `*Template` 并在 `registry.ts` 注册。
 */
export const aliyunConsumedetailBillV2Template: PricingTemplateModule = {
  id: "aliyun.consumedetail_bill_v2",
  label: "阿里云 · consumedetailbill_v2",
  compute(cloudRow: unknown): InternalPricingSnapshot {
    const row = cloudJsonToRawRow(cloudRow);
    const qty = parseNum(row["用量信息/用量"]);
    const mult = ALIYUN_CONSUMEDETAIL_RETAIL_MULTIPLIER;
    const unitCost = pickUnitCostYuan(row, qty);
    const ourUnitYuan = unitCost * mult;
    const lineRetailYuan = ourUnitYuan * (qty > 0 ? qty : 0);
    const chargedPoints =
      qty > 0 && unitCost >= 0 ? Math.max(0, Math.round(lineRetailYuan * 100)) : 0;

    const exampleQty = qty > 0 ? qty : parseNum(row["用量信息/抵扣前用量"]) || 0;
    const formula =
      `本行有效云成本单价(元/单位)=${unitCost.toFixed(6)}；` +
      `我方单价(元/单位)=成本×${mult}=${ourUnitYuan.toFixed(6)}；` +
      `用量=${qty || 0}${row["用量信息/用量单位"] ? " " + row["用量信息/用量单位"] : ""}；` +
      `扣点=round(我方单价×用量×100)=round(${ourUnitYuan.toFixed(6)}×${exampleQty > 0 ? exampleQty : qty}×100)=${chargedPoints}（用量为 0 时扣点为 0，仅展示机会成本单价）；` +
      `模板=${aliyunConsumedetailBillV2Template.label}`;

    return {
      cloudCostUnitYuan: unitCost.toFixed(6),
      retailMultiplier: String(mult),
      ourUnitYuan: ourUnitYuan.toFixed(6),
      formulaText: formula,
      chargedPoints,
      yuanReference: (chargedPoints / 100).toFixed(4),
    };
  },
};
