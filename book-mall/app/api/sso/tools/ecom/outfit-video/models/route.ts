import { NextResponse } from "next/server";

import {
  isStoryLlmVideoUnderstandingModel,
  isStoryLlmVisionModel,
} from "@/lib/canvas/story-llm-vision-models";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { mergeOutfitVideoGatewayVideoModels } from "@/lib/ecom/ecom-outfit-video-models";
import { mergeOutfitFusionGatewayModels, OUTFIT_DEFAULT_FUSION_MODEL } from "@/lib/ecom/ecom-outfit-video-fusion-models";
import { OUTFIT_V1_DEFAULT_SPLIT_MODEL } from "@/lib/ecom/ecom-outfit-video-split-prompts";
import { resolveEcomGatewayBoundKindsForModelPicker } from "@/lib/ecom/ecom-gateway-auth";
import { OUTFIT_V1_DEFAULT_VIDEO_MODEL } from "@/lib/ecom/video-workflow/templates/outfit-v1/constants";
import { registryRowsToEcomModels } from "@/lib/gateway/ecom-storyboard-chat-models";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { ensureGatewayCanonicalRegistrySynced } from "@/lib/gateway/sync-canonical-registry";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const persona = await getUserBillingPersona(auth.userId);
  await ensureGatewayCanonicalRegistrySynced();

  const boundKinds = await resolveEcomGatewayBoundKindsForModelPicker(auth.userId);

  const billingPersona = persona === "PLATFORM_CREDIT" ? "PLATFORM_CREDIT" : "BYOK";

  const [videoModels, chatModels, fusionRegistry] = await Promise.all([
    listModelsForApp({
      appTag: "ecom",
      sceneKey: "ecom-outfit-video",
      role: "VIDEO",
      persona: billingPersona,
      boundKinds,
    }),
    listModelsForApp({
      appTag: "ecom",
      sceneKey: "ecom-media-decompose-chat",
      role: "LLM",
      persona: billingPersona,
      boundKinds,
    }),
    listModelsForApp({
      appTag: "ecom",
      sceneKey: "ecom-outfit-video",
      role: "IMAGE",
      persona: billingPersona,
      boundKinds,
    }),
  ]);

  const videoList = mergeOutfitVideoGatewayVideoModels(
    registryRowsToEcomModels(videoModels),
    boundKinds,
  );
  const defaultVideo =
    videoList.find((m) => m.modelKey === OUTFIT_V1_DEFAULT_VIDEO_MODEL)?.modelKey ??
    videoList.find((m) => m.credentialBound)?.modelKey ??
    videoList[0]?.modelKey ??
    OUTFIT_V1_DEFAULT_VIDEO_MODEL;

  const chatRows = registryRowsToEcomModels(chatModels)
    .filter((m) => isStoryLlmVisionModel(m.modelKey))
    .map((m) => ({
      ...m,
      supportsVideo: isStoryLlmVideoUnderstandingModel(m.modelKey),
    }))
    .filter((m) => m.supportsVideo);

  const defaultSplit =
    chatRows.find((m) => m.modelKey === OUTFIT_V1_DEFAULT_SPLIT_MODEL)?.modelKey ??
    chatRows.find((m) => m.credentialBound)?.modelKey ??
    chatRows[0]?.modelKey ??
    OUTFIT_V1_DEFAULT_SPLIT_MODEL;

  const fusionModels = mergeOutfitFusionGatewayModels(
    registryRowsToEcomModels(fusionRegistry),
    boundKinds,
  );
  const defaultFusion =
    fusionModels.find((m) => m.modelKey === OUTFIT_DEFAULT_FUSION_MODEL)?.modelKey ??
    fusionModels.find((m) => m.credentialBound)?.modelKey ??
    fusionModels[0]?.modelKey ??
    OUTFIT_DEFAULT_FUSION_MODEL;

  return NextResponse.json({
    videoModels: videoList,
    chatModels: chatRows,
    fusionModels,
    platformOffering: persona === "PLATFORM_CREDIT",
    defaults: { video: defaultVideo, split: defaultSplit, fusion: defaultFusion },
  });
}
