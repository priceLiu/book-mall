import { DEFAULT_PRICING_TEMPLATE_KEY } from "./keys";
import { aliyunConsumedetailBillV2Template } from "./aliyun-consumedetail-bill-v2";
import { internalToolUsageV1Template } from "./internal-tool-usage-v1";
import { tencentBillV1Template } from "./tencent-bill-v1";
import type { InternalPricingSnapshot, PricingTemplateModule } from "./types";

/**
 * v004：移除了三个公式型 internal-tool-usage-{token,seconds,image}-v1 模板。
 * 它们历史上从 cloudRow 反推「对内计价/*」 6 列；v004 起这 6 列不再写入 cloudRow，
 * 快照真值持久化在 ToolBillingDetailLine.internal* 7 列，`enrichBillingLineToFlatRow`
 * 直接用 DB 列填"平台/系数(M)+定价+扣点"，不再走 compute() 公式回放。
 */
const BY_ID: Record<string, PricingTemplateModule> = {
  [aliyunConsumedetailBillV2Template.id]: aliyunConsumedetailBillV2Template,
  [internalToolUsageV1Template.id]: internalToolUsageV1Template,
  [tencentBillV1Template.id]: tencentBillV1Template,
};

export function listPricingTemplates(): PricingTemplateModule[] {
  return Object.values(BY_ID);
}

/** 未知 key 时回退默认模板，避免导入坏数据导致整批失败（日志交由调用方） */
export function getPricingTemplate(key: string | null | undefined): PricingTemplateModule {
  const k = (key?.trim() || DEFAULT_PRICING_TEMPLATE_KEY) as string;
  return BY_ID[k] ?? BY_ID[DEFAULT_PRICING_TEMPLATE_KEY];
}

export function computeInternalPricingWithTemplate(
  cloudRow: unknown,
  templateKey?: string | null,
): InternalPricingSnapshot {
  return getPricingTemplate(templateKey).compute(cloudRow);
}

export { type InternalPricingSnapshot, type PricingTemplateModule } from "./types";
export {
  DEFAULT_PRICING_TEMPLATE_KEY,
  PRICING_TEMPLATE_ALIYUN_CONSUMEDETAIL_BILL_V2,
  PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_V1,
} from "./keys";
