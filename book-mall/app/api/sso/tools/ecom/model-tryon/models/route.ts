import { NextResponse } from "next/server";

import { mergeOutfitFusionGatewayModels, OUTFIT_DEFAULT_FUSION_MODEL } from "@/lib/ecom/ecom-outfit-video-fusion-models";
import {
  mergeVtonTextTryonGatewayModels,
  VTON_DEFAULT_TEXT_TRYON_MODEL,
} from "@/lib/ecom/ecom-vton-text-tryon-models";
import { resolveEcomGatewayBoundKindsForModelPicker } from "@/lib/ecom/ecom-gateway-auth";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { registryRowsToEcomModels } from "@/lib/gateway/ecom-storyboard-chat-models";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const persona = await getUserBillingPersona(auth.userId);
  const boundKinds = await resolveEcomGatewayBoundKindsForModelPicker(auth.userId);
  const billingPersona = persona === "PLATFORM_CREDIT" ? "PLATFORM_CREDIT" : "BYOK";

  const [imageRegistry, fusionRegistry, textTryonRegistry] = await Promise.all([
    listModelsForApp({
      appTag: "ecom",
      sceneKey: "ecom-model-shot",
      role: "IMAGE",
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
    listModelsForApp({
      appTag: "ecom",
      role: "IMAGE",
      persona: billingPersona,
      boundKinds,
    }),
  ]);

  const imageModels = registryRowsToEcomModels(imageRegistry);
  const fusionModels = mergeOutfitFusionGatewayModels(
    registryRowsToEcomModels(fusionRegistry),
    boundKinds,
  );
  const textTryonModels = mergeVtonTextTryonGatewayModels(
    registryRowsToEcomModels(textTryonRegistry),
    boundKinds,
  );

  const defaultImage =
    imageModels.find((m) => m.modelKey === ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL)?.modelKey ??
    imageModels.find((m) => m.credentialBound)?.modelKey ??
    imageModels[0]?.modelKey ??
    ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;

  const defaultFusion =
    fusionModels.find((m) => m.modelKey === OUTFIT_DEFAULT_FUSION_MODEL)?.modelKey ??
    fusionModels.find((m) => m.credentialBound)?.modelKey ??
    fusionModels[0]?.modelKey ??
    OUTFIT_DEFAULT_FUSION_MODEL;

  const defaultTextTryon =
    textTryonModels.find((m) => m.modelKey === VTON_DEFAULT_TEXT_TRYON_MODEL)?.modelKey ??
    textTryonModels.find((m) => m.credentialBound)?.modelKey ??
    textTryonModels[0]?.modelKey ??
    VTON_DEFAULT_TEXT_TRYON_MODEL;

  return NextResponse.json({
    imageModels,
    fusionModels,
    textTryonModels,
    defaults: {
      image: defaultImage,
      fusion: defaultFusion,
      textTryon: defaultTextTryon,
    },
  });
}
