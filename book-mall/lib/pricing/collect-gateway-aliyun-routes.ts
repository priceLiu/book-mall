/**
 * 收集 Gateway 注册表中 BAILIAN / DASHSCOPE 路由，供价目导入。
 */
import type { GatewayProviderKind } from "@prisma/client";

import { GATEWAY_CANONICAL_REGISTRY } from "@/lib/platform-model/canonical-registry";

export type GatewayAliyunRoute = {
  canonicalModelKey: string;
  displayName: string;
  modelKey: string;
  providerKind: GatewayProviderKind;
  vendor: string;
  requestKind: string;
};

export function collectGatewayAliyunRoutes(): GatewayAliyunRoute[] {
  const out: GatewayAliyunRoute[] = [];
  const seen = new Set<string>();
  for (const def of GATEWAY_CANONICAL_REGISTRY) {
    for (const r of def.routes) {
      if (r.providerKind !== "BAILIAN" && r.providerKind !== "DASHSCOPE") continue;
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
