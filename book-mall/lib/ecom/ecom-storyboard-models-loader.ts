import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import {
  ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
  ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
  ECOM_STORYBOARD_DEFAULT_VIDEO_MODEL,
  registryRowsToEcomModels,
} from "@/lib/gateway/ecom-storyboard-chat-models";
import { listModelsForApp } from "@/lib/gateway/model-registry";

export type EcomStoryboardGatewayModelsPayload = {
  chatModels: ReturnType<typeof registryRowsToEcomModels>;
  imageModels: ReturnType<typeof registryRowsToEcomModels>;
  videoModels: ReturnType<typeof registryRowsToEcomModels>;
  platformOffering: boolean;
  defaults: {
    chat: string;
    image: string;
    video: string;
  };
};

/** 电商分镜 · Gateway 模型清单（storyboard/models 与 boot 共用） */
export async function loadEcomStoryboardGatewayModels(
  userId: string,
): Promise<EcomStoryboardGatewayModelsPayload> {
  const persona = await getUserBillingPersona(userId);
  const defaults = {
    chat: ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
    image: ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
    video: ECOM_STORYBOARD_DEFAULT_VIDEO_MODEL,
  };

  if (persona === "PLATFORM_CREDIT") {
    const [chatModels, imageModels, videoModels] = await Promise.all([
      listModelsForApp({ appTag: "ecom", role: "LLM", persona: "PLATFORM_CREDIT", boundKinds: [] }),
      listModelsForApp({
        appTag: "ecom",
        sceneKey: "ecom-storyboard-image",
        role: "IMAGE",
        persona: "PLATFORM_CREDIT",
        boundKinds: [],
      }),
      listModelsForApp({ appTag: "ecom", role: "VIDEO", persona: "PLATFORM_CREDIT", boundKinds: [] }),
    ]);
    return {
      chatModels: registryRowsToEcomModels(chatModels),
      imageModels: registryRowsToEcomModels(imageModels),
      videoModels: registryRowsToEcomModels(videoModels),
      platformOffering: true,
      defaults,
    };
  }

  const gw = await resolveEcomGatewayAuthForUser(userId);
  const boundKinds = gw?.credentials.map((c) => c.providerKind) ?? [];
  const [chatModels, imageModels, videoModels] = await Promise.all([
    listModelsForApp({ appTag: "ecom", role: "LLM", persona: "BYOK", boundKinds }),
    listModelsForApp({
      appTag: "ecom",
      sceneKey: "ecom-storyboard-image",
      role: "IMAGE",
      persona: "BYOK",
      boundKinds,
    }),
    listModelsForApp({ appTag: "ecom", role: "VIDEO", persona: "BYOK", boundKinds }),
  ]);

  return {
    chatModels: registryRowsToEcomModels(chatModels),
    imageModels: registryRowsToEcomModels(imageModels),
    videoModels: registryRowsToEcomModels(videoModels),
    platformOffering: false,
    defaults,
  };
}
