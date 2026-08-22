import { resolveVendorCodeForModel } from "@/lib/finance/infer-vendor-code";
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
  minimax: "MiniMax",
  elevenlabs: "ElevenLabs",
  stepfun: "阶跃星辰",
  unknown: "未登记",
};

/** ModelCatalog.vendor 等内部 code → 费用明细展示名 */
export function formatBillingVendorLabel(vendor: string | null | undefined): string {
  const raw = vendor?.trim();
  if (!raw) return "—";
  return VENDOR_LABEL[raw.toLowerCase()] ?? raw;
}

/** 账单 CSV 来源厂商 → 展示名；空表示尚未导入厂商账单 */
export function formatImportVendorLabel(importVendor: string | null | undefined): string {
  const raw = importVendor?.trim();
  if (!raw) return "—";
  return formatBillingVendorLabel(raw);
}

/** 账单行：优先 catalog vendor，否则由 modelKey 推断 */
export function resolveBillingVendorLabel(
  modelKey: string,
  catalogVendor?: string | null,
): string {
  if (catalogVendor?.trim()) return formatBillingVendorLabel(catalogVendor);
  return vendorOfModelKey(modelKey);
}

/** joinKey 首段 → 厂商 code */
export function vendorCodeFromJoinKey(joinKey: string): string {
  return joinKey.split("|")[0]?.trim() ?? "";
}

/**
 * 总表/对账行展示厂商：以 joinKey 厂商段为准（与 Gateway 聚合一致），
 * catalog 仅作不一致告警。
 */
export function resolveMasterLineVendor(input: {
  joinKey: string;
  modelKey: string;
  catalogVendor?: string | null;
}): {
  vendorCode: string;
  vendorDisplayName: string;
  catalogMismatch: boolean;
} {
  const fromJoin = vendorCodeFromJoinKey(input.joinKey);
  const inferred = resolveVendorCodeForModel(input.modelKey, input.catalogVendor);
  const vendorCode =
    fromJoin && fromJoin !== "unknown" ? fromJoin : inferred;
  const catalog = input.catalogVendor?.trim().toLowerCase() ?? "";
  const catalogMismatch =
    catalog.length > 0 &&
    fromJoin.length > 0 &&
    catalog !== fromJoin.toLowerCase() &&
    vendorCode !== "unknown";
  return {
    vendorCode,
    vendorDisplayName: formatBillingVendorLabel(vendorCode),
    catalogMismatch,
  };
}

export function appendCatalogMismatchReason(
  issueReason: string | null | undefined,
  input: { catalogVendor?: string | null; vendorCode: string; modelKey: string },
): string | null {
  const catalog = input.catalogVendor?.trim();
  if (!catalog || !input.vendorCode || catalog.toLowerCase() === input.vendorCode.toLowerCase()) {
    return issueReason ?? null;
  }
  const msg = `Catalog.vendor=${catalog} 与对账厂商 ${input.vendorCode} 不一致（${input.modelKey}）`;
  return issueReason ? `${issueReason}；${msg}` : msg;
}
