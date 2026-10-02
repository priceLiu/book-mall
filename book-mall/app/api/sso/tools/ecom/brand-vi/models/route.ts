import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import { resolveEcomImageGenConcurrency } from "@/lib/ecom/ecom-image-gen-concurrency";
import { mergeIpWorkflowImageModels } from "@/lib/ecom/ecom-ip-workflow-image-models";
import {
  ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
  ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
  registryRowsToEcomModels,
} from "@/lib/gateway/ecom-storyboard-chat-models";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/** 品牌 VI · 表情包：与手办相同，仅返回支持参考图的 IMAGE 模型，优先 KIE / 万相 / 可灵等。 */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return ecomJson({ error: "未登录" }, { status: 401 });
  }

  const rawPersona = await getUserBillingPersona(auth.userId);
  const persona = rawPersona === "PLATFORM_CREDIT" ? "PLATFORM_CREDIT" : "BYOK";

  const boundKinds =
    persona === "PLATFORM_CREDIT"
      ? []
      : (await resolveEcomGatewayAuthForUser(auth.userId))?.credentials.map(
          (c) => c.providerKind,
        ) ?? [];

  const [chatModels, imageModels, allEcomImageModels] = await Promise.all([
    listModelsForApp({ appTag: "ecom", role: "LLM", persona, boundKinds }),
    listModelsForApp({
      appTag: "ecom",
      sceneKey: "ecom-storyboard-image",
      role: "IMAGE",
      persona,
      boundKinds,
    }),
    listModelsForApp({
      appTag: "ecom",
      role: "IMAGE",
      persona,
      boundKinds,
    }),
  ]);

  const sceneImage = registryRowsToEcomModels(imageModels);
  const fullPool = registryRowsToEcomModels(allEcomImageModels);
  const refCapableImageModels = mergeIpWorkflowImageModels(sceneImage, fullPool);
  const imageGenConcurrencyLimit = await resolveEcomImageGenConcurrency(auth.userId, {});

  const defaultImage =
    refCapableImageModels.find((m) => m.modelKey === ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL)
      ?.modelKey ??
    refCapableImageModels[0]?.modelKey ??
    ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;

  return ecomJson({
    chatModels: registryRowsToEcomModels(chatModels),
    imageModels: refCapableImageModels,
    platformOffering: persona === "PLATFORM_CREDIT",
    imageGenConcurrencyLimit,
    defaults: {
      chat: ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
      image: defaultImage,
    },
  });
}
