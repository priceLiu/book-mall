import { NextResponse } from "next/server";

import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import {
  ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
  ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
  ECOM_STORYBOARD_DEFAULT_VIDEO_MODEL,
  registryRowsToEcomModels,
} from "@/lib/gateway/ecom-storyboard-chat-models";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const persona = await getUserBillingPersona(auth.userId);

  if (persona === "PLATFORM_CREDIT") {
    const [chatModels, imageModels, videoModels] = await Promise.all([
      listModelsForApp({ appTag: "ecom", role: "LLM", persona: "PLATFORM_CREDIT", boundKinds: [] }),
      listModelsForApp({ appTag: "ecom", role: "IMAGE", persona: "PLATFORM_CREDIT", boundKinds: [] }),
      listModelsForApp({ appTag: "ecom", role: "VIDEO", persona: "PLATFORM_CREDIT", boundKinds: [] }),
    ]);
    return NextResponse.json({
      chatModels: registryRowsToEcomModels(chatModels),
      imageModels: registryRowsToEcomModels(imageModels),
      videoModels: registryRowsToEcomModels(videoModels),
      platformOffering: true,
      defaults: {
        chat: ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
        image: ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
        video: ECOM_STORYBOARD_DEFAULT_VIDEO_MODEL,
      },
    });
  }

  const gw = await resolveEcomGatewayAuthForUser(auth.userId);
  const boundKinds = gw?.credentials.map((c) => c.providerKind) ?? [];

  const [chatModels, imageModels, videoModels] = await Promise.all([
    listModelsForApp({ appTag: "ecom", role: "LLM", persona: "BYOK", boundKinds }),
    listModelsForApp({ appTag: "ecom", role: "IMAGE", persona: "BYOK", boundKinds }),
    listModelsForApp({ appTag: "ecom", role: "VIDEO", persona: "BYOK", boundKinds }),
  ]);

  return NextResponse.json({
    chatModels: registryRowsToEcomModels(chatModels),
    imageModels: registryRowsToEcomModels(imageModels),
    videoModels: registryRowsToEcomModels(videoModels),
    platformOffering: false,
    defaults: {
      chat: ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
      image: ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
      video: ECOM_STORYBOARD_DEFAULT_VIDEO_MODEL,
    },
  });
}
