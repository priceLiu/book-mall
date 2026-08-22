import { ModelAliasSource } from "@prisma/client";

import { loadModelCatalogBillMaps } from "@/lib/finance/gateway-bill-projection";
import { resolveVendorCodeForModel } from "@/lib/finance/infer-vendor-code";
import { canonicalKeysByAliases } from "@/lib/model-catalog/resolve";

type CatalogPrisma = Parameters<typeof loadModelCatalogBillMaps>[1];

/** 日志 model 字段 → canonical modelKey（与 platform-usage-aggregator 一致）。 */
export function isVendorSpecGatewayModel(model: string): boolean {
  return (
    !model.includes("/") &&
    /^(happyhorse|qwen|wan|text-embedding|cosyvoice|deepseek|pixverse)/i.test(model)
  );
}

export async function resolveCanonicalModelKeysForLogs(
  logs: Array<{
    model?: string | null;
    canonicalModelKey?: string | null;
    pricingModelKey?: string | null;
  }>,
  prisma: CatalogPrisma,
): Promise<Map<string, string>> {
  const aliasInputs = logs.flatMap((log) => {
    const keys = [log.canonicalModelKey, log.model, log.pricingModelKey].filter(Boolean) as string[];
    return keys.map((aliasValue) => ({
      source: ModelAliasSource.VENDOR_RESOURCE_SPEC,
      aliasValue,
    }));
  });
  const aliasLookup = await canonicalKeysByAliases(aliasInputs);

  const out = new Map<string, string>();
  for (const log of logs) {
    const logId = log.canonicalModelKey ?? log.model ?? log.pricingModelKey ?? "";
    if (!logId) continue;
    const gatewayModel = log.model?.trim();
    if (gatewayModel && isVendorSpecGatewayModel(gatewayModel)) {
      out.set(logId, gatewayModel);
      continue;
    }
    let resolved = log.canonicalModelKey ?? log.model ?? "(unknown)";
    for (const k of [log.canonicalModelKey, log.pricingModelKey, log.model]) {
      if (!k) continue;
      const hit = aliasLookup.get(`${ModelAliasSource.VENDOR_RESOURCE_SPEC}::${k}`);
      if (hit) {
        resolved = hit;
        break;
      }
    }
    out.set(logId, resolved);
  }
  return out;
}

/** modelKey → 对账 joinKey 用 vendor code。 */
export async function buildReconciliationVendorCodeMap(
  modelKeys: string[],
  prisma: CatalogPrisma,
): Promise<Map<string, string>> {
  const uniq = [...new Set(modelKeys.filter(Boolean))];
  const { vendors } = await loadModelCatalogBillMaps(uniq, prisma);
  const out = new Map<string, string>();
  for (const key of uniq) {
    out.set(key, resolveVendorCodeForModel(key, vendors.get(key)));
  }
  return out;
}
