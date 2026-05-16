/** 对内计价模板标识（库内 `ToolBillingDetailLine.pricingTemplateKey`），便于多云厂商扩展。 */
export const PRICING_TEMPLATE_ALIYUN_CONSUMEDETAIL_BILL_V2 =
  "aliyun.consumedetail_bill_v2" as const;

/**
 * 工具站内部使用计费（TOOL_USAGE_GENERATED）：直接来自 `ToolUsageEvent` 的点数扣费，
 * 不需要重算云厂商有效单价；用于在财务控制台展示用户实际产生的扣点流水。
 */
export const PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_V1 =
  "internal.tool_usage_v1" as const;

/** v002 P2-2：文本类（token in/out 计费）公式模板。 */
export const PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_TOKEN_V1 =
  "internal.tool_usage_token_v1" as const;

/** v002 P2-2：视频按秒类公式模板（含 happyhorse 系列）。 */
export const PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_SECONDS_V1 =
  "internal.tool_usage_seconds_v1" as const;

/** v002 P2-2：图像按张类公式模板（文生图、图生图等）。 */
export const PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_IMAGE_V1 =
  "internal.tool_usage_image_v1" as const;

export type PricingTemplateKey = string;

export const DEFAULT_PRICING_TEMPLATE_KEY: PricingTemplateKey =
  PRICING_TEMPLATE_ALIYUN_CONSUMEDETAIL_BILL_V2;
