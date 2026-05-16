/**
 * v002 P4-1：腾讯云 BillingItem 对内计价模板（骨架，未启用）。
 *
 * 设计目标：让「平台 = 云厂商代理」在多云上自然展开。
 *   - 当 `BILLING_IMPORT_PRICING_TEMPLATE=tencent.bill_v1` 时，`scripts/billing-import-cloud-csv.ts`
 *     会通过 registry 拿到本模板并 compute；当前未对接，等接入腾讯云账单 CSV 字段表后填实。
 *   - 字段命名遵循 aliyun 模板的中文 key 风格，便于 finance-web 复用同套表头。
 *
 * 待接入步骤（实施时一次性完成）：
 *   1) 抓一份腾讯云 BillingItem 的 CSV 样本，确定列名映射。
 *   2) 在本文件 `compute` 中实现 cost / mult / points 的解析（参考 aliyun-consumedetail-bill-v2.ts）。
 *   3) 在 `enrichBillingLineToFlatRow` 投影逻辑中处理腾讯云特有列（若有）。
 *   4) 文档：在 `tool-web/doc/reconciliation-baseline-2026-05-16-v002.md` §4 补一行表格。
 */
import type { InternalPricingSnapshot, PricingTemplateModule } from "./types";

const PLACEHOLDER_FORMULA =
  "tencent.bill_v1 模板尚未实现：等接入腾讯云 BillingItem CSV 样本后再实装；当前不参与计算。";

export const tencentBillV1Template: PricingTemplateModule = {
  id: "tencent.bill_v1",
  label: "腾讯云 · BillingItem v1（占位，未实装）",
  compute(_cloudRow: unknown): InternalPricingSnapshot {
    return {
      cloudCostUnitYuan: "0.000000",
      retailMultiplier: "0",
      ourUnitYuan: "0.000000",
      formulaText: PLACEHOLDER_FORMULA,
      chargedPoints: 0,
      yuanReference: "0.0000",
    };
  },
};
