import type { GatewayProviderKind } from "@prisma/client";

import { findDeepseekListPrice } from "@/lib/pricing/deepseek-v4-pricing";

/**
 * modelKey / ModelCatalog.vendor → 对账用厂商 code（aliyun / kie / minimax …）。
 * 展示名见 formatBillingVendorLabel。
 */
export function inferVendorCodeFromModelKey(modelKey: string | null | undefined): string {
  if (!modelKey?.trim()) return "unknown";
  const k = modelKey.toLowerCase();

  if (
    k.startsWith("qwen") ||
    k.startsWith("wan") ||
    k.startsWith("dashscope") ||
    k.startsWith("wanx") ||
    k.startsWith("aitryon") ||
    k.startsWith("happyhorse") ||
    k.startsWith("text-embedding") ||
    k.startsWith("cosyvoice") ||
    k.startsWith("paraformer")
  ) {
    return "aliyun";
  }
  if (k.startsWith("hunyuan") || k.startsWith("tencent")) return "tencent";
  if (k.startsWith("ep-") || k.startsWith("doubao") || k.startsWith("volc") || k.startsWith("ark")) {
    return "volcengine";
  }
  if (k.startsWith("baichuan")) return "baichuan";
  if (k.startsWith("kimi")) return "aliyun";
  if (k.startsWith("moonshot")) return "moonshot";
  if (k.startsWith("deepseek")) return "deepseek";
  if (k.startsWith("glm") || k.startsWith("chatglm") || k.startsWith("zhipu")) return "zhipu";
  if (k.startsWith("ernie") || k.startsWith("wenxin")) return "baidu";
  if (k.includes("minimax") || k.startsWith("minimax")) return "minimax";
  if (k.startsWith("eleven") || k.includes("elevenlabs")) return "elevenlabs";
  if (
    k.startsWith("lib-nano") ||
    k.startsWith("nano-banana") ||
    k.startsWith("kling") ||
    k.startsWith("gpt-image") ||
    k.startsWith("gpt-4o") ||
    k.startsWith("4o-image") ||
    k.startsWith("google/") ||
    k.startsWith("grok-") ||
    k.startsWith("veo") ||
    k.startsWith("seedance") ||
    k.startsWith("bytedance/") ||
    k.startsWith("topaz/") ||
    k.startsWith("pixverse")
  ) {
    return "kie";
  }
  if (k.startsWith("step") || k.startsWith("yi-")) return "stepfun";

  return "unknown";
}

export function resolveVendorCodeForModel(
  modelKey: string,
  catalogVendor?: string | null,
): string {
  const fromCatalog = catalogVendor?.trim().toLowerCase();
  if (fromCatalog) return fromCatalog;
  return inferVendorCodeFromModelKey(modelKey);
}

/** Gateway 路由优先：DEEPSEEK 直连对 deepseek CSV；百炼代销 deepseek 仍归 aliyun。 */
export function resolveReconciliationVendorCode(input: {
  providerKind?: GatewayProviderKind | null;
  modelKey: string;
  catalogVendor?: string | null;
}): string {
  const pk = input.providerKind;
  if (pk === "DEEPSEEK") return "deepseek";
  if (
    (pk === "BAILIAN" || pk === "DASHSCOPE") &&
    findDeepseekListPrice(input.modelKey)
  ) {
    return "aliyun";
  }
  return resolveVendorCodeForModel(input.modelKey, input.catalogVendor);
}
