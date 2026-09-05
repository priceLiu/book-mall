import { NextResponse } from "next/server";

import {
  assertStoryLlmVideoUnderstandingModel,
  assertStoryLlmVisionModel,
  isStoryLlmVideoUnderstandingModel,
  isStoryLlmVisionModel,
} from "@/lib/canvas/story-llm-vision-models";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import { isRefCapableEcomImageModel } from "@/lib/ecom/ecom-image-gen-invoke";
import {
  ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL,
} from "@/lib/ecom/ecom-media-decompose-types";
import {
  ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
  registryRowsToEcomModels,
} from "@/lib/gateway/ecom-storyboard-chat-models";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { ensureGatewayCanonicalRegistrySynced } from "@/lib/gateway/sync-canonical-registry";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/** 拆图拆视频：Vision LLM；标注 supportsVideo */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const persona = await getUserBillingPersona(auth.userId);
  await ensureGatewayCanonicalRegistrySynced();

  const boundKinds =
    persona === "PLATFORM_CREDIT"
      ? []
      : (await resolveEcomGatewayAuthForUser(auth.userId))?.credentials.map(
          (c) => c.providerKind,
        ) ?? [];

  const billingPersona = persona === "PLATFORM_CREDIT" ? "PLATFORM_CREDIT" : "BYOK";

  const [chatModels, imageModels] = await Promise.all([
    listModelsForApp({
      appTag: "ecom",
      sceneKey: "ecom-media-decompose-chat",
      role: "LLM",
      persona: billingPersona,
      boundKinds,
    }),
    listModelsForApp({
      appTag: "ecom",
      sceneKey: "ecom-media-decompose-image",
      role: "IMAGE",
      persona: billingPersona,
      boundKinds,
    }),
  ]);

  const chatRows = registryRowsToEcomModels(chatModels)
    .filter((m) => isStoryLlmVisionModel(m.modelKey))
    .map((m) => ({
      ...m,
      supportsVideo: isStoryLlmVideoUnderstandingModel(m.modelKey),
    }));

  const defaultChat =
    chatRows.find((m) => m.modelKey === ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL)?.modelKey ??
    chatRows.find((m) => m.credentialBound)?.modelKey ??
    chatRows[0]?.modelKey ??
    ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL;

  const allImageModels = registryRowsToEcomModels(imageModels);
  const refCapable = allImageModels.filter((m) => isRefCapableEcomImageModel(m.modelKey));
  const imageList = refCapable.length > 0 ? refCapable : allImageModels;
  const defaultImage =
    imageList.find((m) => m.modelKey === ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL)?.modelKey ??
    imageList.find((m) => m.credentialBound)?.modelKey ??
    imageList[0]?.modelKey ??
    ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;

  return NextResponse.json({
    chatModels: chatRows,
    imageModels: imageList,
    platformOffering: persona === "PLATFORM_CREDIT",
    defaults: { chat: defaultChat, image: defaultImage },
  });
}
