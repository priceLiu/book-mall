import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import {
  BACKGROUND_REPLACE_MODEL_KEYS,
  SEEDREAM_BACKGROUND_REPLACE_MODEL,
} from "@/lib/ecom/ecom-background-replace";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import { registryRowsToEcomModels } from "@/lib/gateway/ecom-storyboard-chat-models";
import { listModelsForApp } from "@/lib/gateway/model-registry";

const ALLOWED = new Set<string>(BACKGROUND_REPLACE_MODEL_KEYS);

export async function loadBackgroundReplaceModels(userId: string) {
  const persona = await getUserBillingPersona(userId);
  const boundKinds =
    persona === "PLATFORM_CREDIT"
      ? []
      : ((await resolveEcomGatewayAuthForUser(userId))?.credentials.map(
          (c) => c.providerKind,
        ) ?? []);

  const imageModels = await listModelsForApp({
    appTag: "ecom",
    role: "IMAGE",
    persona: persona === "PLATFORM_CREDIT" ? "PLATFORM_CREDIT" : "BYOK",
    boundKinds,
  });

  const filtered = registryRowsToEcomModels(imageModels)
    .filter((m) => ALLOWED.has(m.modelKey))
    .sort((a, b) => {
      if (a.modelKey === SEEDREAM_BACKGROUND_REPLACE_MODEL) return -1;
      if (b.modelKey === SEEDREAM_BACKGROUND_REPLACE_MODEL) return 1;
      return 0;
    });

  return {
    imageModels: filtered,
    defaultModel: SEEDREAM_BACKGROUND_REPLACE_MODEL,
    platformOffering: persona === "PLATFORM_CREDIT",
  };
}
