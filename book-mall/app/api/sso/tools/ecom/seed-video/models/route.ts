import { NextResponse } from "next/server";

import { isStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import {
  ECOM_SEED_VIDEO_DEFAULT_CHAT_MODEL,
  ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL,
} from "@/lib/ecom/ecom-seed-video-types";
import { registryRowsToEcomModels } from "@/lib/gateway/ecom-storyboard-chat-models";
import { mergeSeedVideoGatewayVideoModels } from "@/lib/ecom/ecom-seed-video-models";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { ensureGatewayCanonicalRegistrySynced } from "@/lib/gateway/sync-canonical-registry";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/** 种草视频：策划助手须图片理解，只暴露 vision LLM + 视频模型 */
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

  const [chatModels, videoModels] = await Promise.all([
    listModelsForApp({ appTag: "ecom", role: "LLM", persona: billingPersona, boundKinds }),
    listModelsForApp({ appTag: "ecom", role: "VIDEO", persona: billingPersona, boundKinds }),
  ]);

  const chatRows = registryRowsToEcomModels(chatModels);
  const visionChatModels = chatRows.filter((m) => isStoryLlmVisionModel(m.modelKey));
  const videoRows = mergeSeedVideoGatewayVideoModels(
    registryRowsToEcomModels(videoModels),
    boundKinds,
  );
  const defaultChat =
    visionChatModels.find((m) => m.modelKey === ECOM_SEED_VIDEO_DEFAULT_CHAT_MODEL)
      ?.modelKey ??
    visionChatModels.find((m) => m.credentialBound)?.modelKey ??
    visionChatModels[0]?.modelKey ??
    ECOM_SEED_VIDEO_DEFAULT_CHAT_MODEL;

  return NextResponse.json({
    chatModels: visionChatModels,
    videoModels: videoRows,
    platformOffering: persona === "PLATFORM_CREDIT",
    defaults: {
      chat: defaultChat,
      video: ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL,
    },
  });
}
