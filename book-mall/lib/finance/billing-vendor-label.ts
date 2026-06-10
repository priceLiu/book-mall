import { vendorOfModelKey } from "@/lib/finance/vendor-of-model-key";

const VENDOR_LABEL: Record<string, string> = {
  aliyun: "阿里云",
  tencent: "腾讯云",
  volcengine: "火山引擎",
  volc: "火山引擎",
  huawei: "华为云",
  kie: "KIE",
  deepseek: "DeepSeek",
  zhipu: "智谱 AI",
  moonshot: "Moonshot",
  baidu: "百度文心",
  baichuan: "百川",
};

/** ModelCatalog.vendor 等内部 code → 费用明细展示名 */
export function formatBillingVendorLabel(vendor: string | null | undefined): string {
  const raw = vendor?.trim();
  if (!raw) return "—";
  return VENDOR_LABEL[raw.toLowerCase()] ?? raw;
}

/** 账单行：优先 catalog vendor，否则由 modelKey 推断 */
export function resolveBillingVendorLabel(
  modelKey: string,
  catalogVendor?: string | null,
): string {
  if (catalogVendor?.trim()) return formatBillingVendorLabel(catalogVendor);
  return vendorOfModelKey(modelKey);
}
