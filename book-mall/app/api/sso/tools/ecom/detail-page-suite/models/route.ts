import { NextResponse } from "next/server";

import { isStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import {
  resolveEcomImageGenConcurrency,
  resolveEcomPromptGenConcurrency,
} from "@/lib/ecom/ecom-image-gen-concurrency";
import { isRefCapableEcomImageModel } from "@/lib/ecom/ecom-image-gen-invoke";
import {
  ECOM_DEFAULT_VISION_MODEL,
  ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
  registryRowsToEcomModels,
} from "@/lib/gateway/ecom-storyboard-chat-models";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

/** 详情页套图优先展示（含参考图生图） */
const DETAIL_PAGE_SUITE_PREFERRED_IMAGE_KEYS = [
  "nano-banana-pro",
  "gpt-image-2",
] as const;

export const dynamic = "force-dynamic";

function mergePreferredImageModels(
  primary: ReturnType<typeof registryRowsToEcomModels>,
  pool: ReturnType<typeof registryRowsToEcomModels>,
): ReturnType<typeof registryRowsToEcomModels> {
  const out = [...primary];
  const seen = new Set(out.map((m) => m.modelKey));
  for (const key of DETAIL_PAGE_SUITE_PREFERRED_IMAGE_KEYS) {
    if (seen.has(key)) continue;
    const hit = pool.find(
      (m) => m.modelKey === key && isRefCapableEcomImageModel(m.modelKey),
    );
    if (!hit) continue;
    out.push(hit);
    seen.add(key);
  }
  return out;
}

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const rawPersona = await getUserBillingPersona(auth.userId);
  const persona = rawPersona === "PLATFORM_CREDIT" ? "PLATFORM_CREDIT" : "BYOK";
  const boundKinds =
    persona === "PLATFORM_CREDIT"
      ? []
      : (await resolveEcomGatewayAuthForUser(auth.userId))?.credentials.map(
          (c) => c.providerKind,
        ) ?? [];

  const [chatModels, imageModels, allEcomImageModels] = await Promise.all([
    listModelsForApp({
      appTag: "ecom",
      sceneKey: "ecom-model-shot-chat",
      role: "LLM",
      persona,
      boundKinds,
    }),
    listModelsForApp({
      appTag: "ecom",
      sceneKey: "ecom-model-shot-image",
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

  const allChatModels = registryRowsToEcomModels(chatModels);
  const visionChatModels = allChatModels.filter((m) => isStoryLlmVisionModel(m.modelKey));
  const chatList = visionChatModels.length > 0 ? visionChatModels : allChatModels;
  const allImageModels = registryRowsToEcomModels(imageModels);
  const allEcomImage = registryRowsToEcomModels(allEcomImageModels);
  const refCapable = allImageModels.filter((m) => isRefCapableEcomImageModel(m.modelKey));
  const imageList = mergePreferredImageModels(
    refCapable.length > 0 ? refCapable : allImageModels,
    allEcomImage.filter((m) => isRefCapableEcomImageModel(m.modelKey)),
  );
  const defaultChat =
    chatList.find((m) => m.modelKey === ECOM_DEFAULT_VISION_MODEL)?.modelKey ??
    chatList.find((m) => m.credentialBound)?.modelKey ??
    chatList[0]?.modelKey ??
    ECOM_DEFAULT_VISION_MODEL;

  const [imageGenConcurrencyLimit, promptGenConcurrencyLimit] = await Promise.all([
    resolveEcomImageGenConcurrency(auth.userId, {}),
    resolveEcomPromptGenConcurrency(auth.userId),
  ]);

  return NextResponse.json({
    chatModels: chatList,
    imageModels: imageList,
    defaults: {
      chat: defaultChat,
      image: imageList[0]?.modelKey ?? ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
    },
    imageGenConcurrencyLimit,
    promptGenConcurrencyLimit,
  });
}
