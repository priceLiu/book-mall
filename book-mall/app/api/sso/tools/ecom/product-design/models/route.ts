import { NextResponse } from "next/server";

import { isStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import {
  ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
  ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
  registryRowsToEcomModels,
} from "@/lib/gateway/ecom-storyboard-chat-models";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { resolveEcomImageGenConcurrency } from "@/lib/ecom/ecom-image-gen-concurrency";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/** 产品创作只用文本 + 生图两类模型，视频交给微剧故事版 */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rawPersona = await getUserBillingPersona(auth.userId);
  const persona = rawPersona === "PLATFORM_CREDIT" ? "PLATFORM_CREDIT" : "BYOK";

  const boundKinds =
    persona === "PLATFORM_CREDIT"
      ? []
      : (await resolveEcomGatewayAuthForUser(auth.userId))?.credentials.map(
          (c) => c.providerKind,
        ) ?? [];

  const [chatModels, imageModels] = await Promise.all([
    listModelsForApp({ appTag: "ecom", role: "LLM", persona, boundKinds }),
    listModelsForApp({ appTag: "ecom", role: "IMAGE", persona, boundKinds }),
  ]);

  const chatRows = registryRowsToEcomModels(chatModels);
  const visionModels = chatRows.filter((m) => isStoryLlmVisionModel(m.modelKey));
  const imageGenConcurrencyLimit = await resolveEcomImageGenConcurrency(auth.userId, {});

  return NextResponse.json({
    chatModels: chatRows,
    visionModels,
    imageModels: registryRowsToEcomModels(imageModels),
    platformOffering: persona === "PLATFORM_CREDIT",
    imageGenConcurrencyLimit,
    defaults: {
      chat: ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
      vision:
        visionModels[0]?.modelKey ?? ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
      image: ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
    },
  });
}
