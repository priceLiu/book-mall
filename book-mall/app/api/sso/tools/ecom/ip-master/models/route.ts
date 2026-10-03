import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import {
  ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
  registryRowsToEcomModels,
} from "@/lib/gateway/ecom-storyboard-chat-models";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });

  const rawPersona = await getUserBillingPersona(auth.userId);
  const persona = rawPersona === "PLATFORM_CREDIT" ? "PLATFORM_CREDIT" : "BYOK";
  const boundKinds =
    persona === "PLATFORM_CREDIT"
      ? []
      : (await resolveEcomGatewayAuthForUser(auth.userId))?.credentials.map(
          (c) => c.providerKind,
        ) ?? [];

  const chatModels = await listModelsForApp({
    appTag: "ecom",
    role: "LLM",
    persona,
    boundKinds,
  });

  return ecomJson({
    chatModels: registryRowsToEcomModels(chatModels),
    defaultChatModelKey: ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
  });
}
