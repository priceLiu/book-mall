/**
 * Story · Gateway 统一注册表模型列表（模型运营中心）
 */
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { getGatewayLinkStatusForUser } from "@/lib/gateway/book-gateway-link";
import { listModelsForApp } from "@/lib/gateway/model-registry";

export async function listStoryRegistryEngineModels(userId: string) {
  const persona = await getUserBillingPersona(userId);
  const link = await getGatewayLinkStatusForUser(userId);
  const boundKinds = link.boundKinds ?? [];
  const rows = await listModelsForApp({
    appTag: "story",
    persona: persona === "PLATFORM_CREDIT" ? "PLATFORM_CREDIT" : "BYOK",
    boundKinds,
  });
  return rows.map((r, idx) => ({
    id: `registry:${r.canonicalModelKey}`,
    modelKey: r.modelKey,
    displayName: r.displayName,
    description: r.description,
    role: r.role,
    sourceLabel: r.sourceLabel,
    sortOrder: r.sortOrder ?? idx,
    active: true,
    providerKind: r.providerKind,
    platformOffering: r.platformOffering,
  }));
}
