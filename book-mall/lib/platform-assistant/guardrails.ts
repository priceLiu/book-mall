/**
 * 平台 AI 导览助手 · 护栏。
 * 价格 / 计费 / 财务 / 平台计算规则一律不作答，引导到报价体系。
 */
import { getBookMallOrigin } from "@/lib/gateway/env";

/** 命中即拒答的敏感话题关键词（价格 / 计费 / 财务 / 平台计算规则）。 */
const SENSITIVE_PATTERNS: RegExp[] = [
  /价格|价钱|多少钱|费用|收费|收多少|报价|定价/,
  /计费|结算|扣费|扣点|扣积分|消耗积分|积分.*(消耗|扣|多少|规则|单价)/,
  /充值|付费|订阅.*(价|费)|会员.*(价|费)|套餐.*(价|费)/,
  /退款|发票|开票|对账|账单/,
  /成本|毛利|利润|定倍|倍率|单价|计算规则|如何计算|怎么算/,
  /price|pricing|cost|billing|refund|invoice|credits?\s*(cost|price|rule)/i,
];

export function isSensitiveTopic(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return SENSITIVE_PATTERNS.some((re) => re.test(t));
}

/** 报价页链接。 */
export function pricingUrl(): string {
  const origin = getBookMallOrigin() ?? "";
  return `${origin.replace(/\/$/, "")}/pricing`;
}

/** 命中敏感话题时的固定话术。 */
export function sensitiveTopicReply(): string {
  return `关于价格、计费与平台计算规则，请见平台的报价体系：${pricingUrl()} 。\n\n我可以帮你了解各应用的功能与使用方式，有什么想先了解的吗？`;
}
