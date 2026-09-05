/** KIE 标准充值档：¥36 / 1000 积分 */
export const KIE_CREDIT_YUAN = 0.036;

export const KIE_PRICING_API_URL = "https://api.kie.ai/client/v1/model-pricing/page";

export const KIE_PRICING_SOURCE_URL = "https://kie.ai/zh-CN/pricing";

export function kieCreditsToYuan(credits: number): number {
  return credits * KIE_CREDIT_YUAN;
}

/** 百 tokens → 元/千 token（与 ali ktokenFromMillion 对齐） */
export function ktokenFromKieMillionCredits(creditsPerMillion: number): number {
  return kieCreditsToYuan(creditsPerMillion) / 1000;
}
