import { NextResponse } from "next/server";

import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import { resolveEcomImageGenConcurrency } from "@/lib/ecom/ecom-image-gen-concurrency";
import { isRefCapableEcomImageModel } from "@/lib/ecom/ecom-image-gen-invoke";
import {
  ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
  ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
  registryRowsToEcomModels,
} from "@/lib/gateway/ecom-storyboard-chat-models";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/**
 * 手伴创作只需文本 + 生图两类模型。
 *
 * 生图模型必须支持参考图：10 步一致性全靠「基准主形象作参考图」，
 * 纯文生图模型每步都会换脸，因此在选择器层就过滤掉。
 */
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
    listModelsForApp({
      appTag: "ecom",
      sceneKey: "ecom-storyboard-image",
      role: "IMAGE",
      persona,
      boundKinds,
    }),
  ]);

  const allImageModels = registryRowsToEcomModels(imageModels);
  const refCapable = allImageModels.filter((m) => isRefCapableEcomImageModel(m.modelKey));
  // 全部被过滤掉时宁可放开，也不要让工作台没有可选模型
  const refCapableImageModels = refCapable.length > 0 ? refCapable : allImageModels;
  const imageGenConcurrencyLimit = await resolveEcomImageGenConcurrency(auth.userId, {});

  return NextResponse.json({
    chatModels: registryRowsToEcomModels(chatModels),
    imageModels: refCapableImageModels,
    platformOffering: persona === "PLATFORM_CREDIT",
    imageGenConcurrencyLimit,
    defaults: {
      chat: ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
      image:
        refCapableImageModels[0]?.modelKey ?? ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
    },
  });
}
