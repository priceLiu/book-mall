/** 对内计价模板标识（库内 `ToolBillingDetailLine.pricingTemplateKey`），便于多云厂商扩展。 */
export const PRICING_TEMPLATE_ALIYUN_CONSUMEDETAIL_BILL_V2 =
  "aliyun.consumedetail_bill_v2" as const;

/**
 * 工具站内部使用计费（TOOL_USAGE_GENERATED）：直接来自 `ToolUsageEvent` 的点数扣费，
 * 不需要重算云厂商有效单价；用于在财务控制台展示用户实际产生的扣点流水。
 *
 * v004 起 cloudRow 已不再写"对内计价/*"列；本 key 仅作 ToolBillingDetailLine 的
 * `pricingTemplateKey` 字段值，让 registry 仍能解析到一个无害的 fallback compute()。
 */
export const PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_V1 =
  "internal.tool_usage_v1" as const;

export type PricingTemplateKey = string;

export const DEFAULT_PRICING_TEMPLATE_KEY: PricingTemplateKey =
  PRICING_TEMPLATE_ALIYUN_CONSUMEDETAIL_BILL_V2;
