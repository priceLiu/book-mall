import { NextResponse } from "next/server";

import {
  isStoryLlmVideoUnderstandingModel,
  isStoryLlmVisionModel,
} from "@/lib/canvas/story-llm-vision-models";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import { mergeSeedVideoGatewayVideoModels } from "@/lib/ecom/ecom-seed-video-models";
import {
  ECOM_FILM_PULL_DEFAULT_CHAT_MODEL,
  ECOM_FILM_PULL_DEFAULT_VIDEO_MODEL,
} from "@/lib/ecom/ecom-film-pull-types";
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

  const boundKinds =
    persona === "PLATFORM_CREDIT"
      ? []
      : (await resolveEcomGatewayAuthForUser(auth.userId))?.credentials.map(
          (c) => c.providerKind,
        ) ?? [];

  const billingPersona = persona === "PLATFORM_CREDIT" ? "PLATFORM_CREDIT" : "BYOK";

  const [chatModels, videoModels] = await Promise.all([
    listModelsForApp({
      appTag: "ecom",
      sceneKey: "ecom-film-pull-chat",
      role: "LLM",
      persona: billingPersona,
      boundKinds,
    }),
    listModelsForApp({ appTag: "ecom", role: "VIDEO", persona: billingPersona, boundKinds }),
  ]);

  const chatRows = registryRowsToEcomModels(chatModels)
    .filter((m) => isStoryLlmVisionModel(m.modelKey))
    .map((m) => ({
      ...m,
      supportsVideo: isStoryLlmVideoUnderstandingModel(m.modelKey),
    }));

  const videoRows = mergeSeedVideoGatewayVideoModels(
    registryRowsToEcomModels(videoModels),
    boundKinds,
  );

  const defaultChat =
    chatRows.find(
      (m) => m.modelKey === ECOM_FILM_PULL_DEFAULT_CHAT_MODEL && m.supportsVideo,
    )?.modelKey ??
    chatRows.find((m) => m.supportsVideo && m.credentialBound)?.modelKey ??
    chatRows.find((m) => m.supportsVideo)?.modelKey ??
    chatRows.find((m) => m.credentialBound)?.modelKey ??
    chatRows[0]?.modelKey ??
    ECOM_FILM_PULL_DEFAULT_CHAT_MODEL;

  const defaultVideo =
    videoRows.find((m) => m.modelKey === ECOM_FILM_PULL_DEFAULT_VIDEO_MODEL)?.modelKey ??
    videoRows.find((m) => m.credentialBound)?.modelKey ??
    videoRows[0]?.modelKey ??
    ECOM_FILM_PULL_DEFAULT_VIDEO_MODEL;

  return NextResponse.json({
    chatModels: chatRows,
    videoModels: videoRows,
    platformOffering: persona === "PLATFORM_CREDIT",
    defaults: { chat: defaultChat, video: defaultVideo },
  });
}
