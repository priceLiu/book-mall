import { DEFAULT_PRICING_TEMPLATE_KEY } from "./keys";
import { aliyunConsumedetailBillV2Template } from "./aliyun-consumedetail-bill-v2";
import { internalToolUsageV1Template } from "./internal-tool-usage-v1";
import {
  internalToolUsageImageV1Template,
  internalToolUsageSecondsV1Template,
  internalToolUsageTokenV1Template,
} from "./internal-tool-usage-formula";
import { tencentBillV1Template } from "./tencent-bill-v1";
import type { InternalPricingSnapshot, PricingTemplateModule } from "./types";

const BY_ID: Record<string, PricingTemplateModule> = {
  [aliyunConsumedetailBillV2Template.id]: aliyunConsumedetailBillV2Template,
  [internalToolUsageV1Template.id]: internalToolUsageV1Template,
  [internalToolUsageTokenV1Template.id]: internalToolUsageTokenV1Template,
  [internalToolUsageSecondsV1Template.id]: internalToolUsageSecondsV1Template,
  [internalToolUsageImageV1Template.id]: internalToolUsageImageV1Template,
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
  PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_TOKEN_V1,
  PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_SECONDS_V1,
  PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_IMAGE_V1,
} from "./keys";
