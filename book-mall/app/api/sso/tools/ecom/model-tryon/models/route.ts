import { NextResponse } from "next/server";

import { mergeOutfitFusionGatewayModels, OUTFIT_DEFAULT_FUSION_MODEL } from "@/lib/ecom/ecom-outfit-video-fusion-models";
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

  const [imageRegistry, fusionRegistry] = await Promise.all([
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
  ]);

  const imageModels = registryRowsToEcomModels(imageRegistry);
  const fusionModels = mergeOutfitFusionGatewayModels(
    registryRowsToEcomModels(fusionRegistry),
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

  return NextResponse.json({
    imageModels,
    fusionModels,
    defaults: { image: defaultImage, fusion: defaultFusion },
  });
}
