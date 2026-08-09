/**
 * 收集 Gateway 注册表中 KIE 路由，供价目导入。
 */
import type { GatewayProviderKind } from "@prisma/client";

import { GATEWAY_CANONICAL_REGISTRY } from "@/lib/platform-model/canonical-registry";

export type GatewayKieRoute = {
  canonicalModelKey: string;
  displayName: string;
  modelKey: string;
  providerKind: GatewayProviderKind;
  vendor: string;
  requestKind: string;
};

const HAPPYHORSE_SLUG = /happy-?horse/i;

export function collectGatewayKieRoutes(): GatewayKieRoute[] {
  const out: GatewayKieRoute[] = [];
  const seen = new Set<string>();
  for (const def of GATEWAY_CANONICAL_REGISTRY) {
    for (const r of def.routes) {
      if (r.providerKind !== "KIE") continue;
      if (HAPPYHORSE_SLUG.test(r.modelKey) || HAPPYHORSE_SLUG.test(def.canonicalModelKey)) {
        continue;
      }
      const fp = `${def.canonicalModelKey}|${r.modelKey}|${r.providerKind}`;
      if (seen.has(fp)) continue;
      seen.add(fp);
      out.push({
        canonicalModelKey: def.canonicalModelKey,
        displayName: def.displayName,
        modelKey: r.modelKey,
        providerKind: r.providerKind,
        vendor: r.vendor,
        requestKind: def.requestKind,
      });
    }
  }
  return out.sort((a, b) => a.canonicalModelKey.localeCompare(b.canonicalModelKey));
}
