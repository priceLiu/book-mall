/**
 * 由 modelKey 推断云厂商展示名（fallback，优先 ModelCatalog.vendor）。
 * @deprecated 新代码请用 resolveBillingVendorLabel + inferVendorCodeFromModelKey
 */
import { formatBillingVendorLabel } from "@/lib/finance/billing-vendor-label";
import { inferVendorCodeFromModelKey } from "@/lib/finance/infer-vendor-code";

export function vendorOfModelKey(modelKey: string | null | undefined): string {
  return formatBillingVendorLabel(inferVendorCodeFromModelKey(modelKey));
}
