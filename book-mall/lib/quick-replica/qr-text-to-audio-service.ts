import type { GatewayProviderKind } from "@prisma/client";

import {
  getQrAudioVoiceDef,
  QR_DEFAULT_AUDIO_MODEL_KEY,
} from "@/lib/quick-replica/qr-audio-catalog";
import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import {
  normalizeVoiceControls,
  validateTextToAudioDraft,
} from "@/lib/quick-replica/qr-text-to-audio-models";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";
import { prisma } from "@/lib/prisma";

const CLIENT_PAGE = "quick-replica/create-voiceover";

/** 演示用旁白样本（模拟 Gateway TTS 输出） */
const MOCK_AUDIO_OUTPUT_URL =
  "https://storage.googleapis.com/media-session/sintel/sintel.mp3";

export async function qrCreateTextToAudioJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind | string }> {
  const validationError = validateTextToAudioDraft({
    modelKey: draft.modelKey,
    voiceId: draft.voiceId,
    prompt: draft.prompt,
  });
  if (validationError) throw new Error(validationError);

  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心关联 Gateway API Key");
  }

  const voice = getQrAudioVoiceDef(draft.voiceId ?? "");
  const controls = normalizeVoiceControls(draft);
  const modelKey = draft.modelKey.trim() || QR_DEFAULT_AUDIO_MODEL_KEY;
  const now = new Date();

  const log = await prisma.gatewayRequestLog.create({
    data: {
      userId: auth.userId,
      apiKeyId: auth.id,
      actorBookUserId: userId,
      model: modelKey,
      endpoint: "quick-replica/mock-tts",
      providerKind: "KIE",
      requestKind: "TTS",
      status: "SUCCEEDED",
      clientSource: "QUICK_REPLICA",
      clientPage: CLIENT_PAGE,
      submittedAt: now,
      completedAt: now,
      inputSummary: {
        qrTextToAudio: {
          prompt: draft.prompt,
          modelKey,
          voiceId: voice.voiceId,
          audioStyleTag: draft.audioStyleTag ?? null,
          voiceControls: controls,
          draft,
        },
      },
      resultSummary: {
        audio_url: MOCK_AUDIO_OUTPUT_URL,
        url: MOCK_AUDIO_OUTPUT_URL,
        mock: true,
      },
    },
  });

  return {
    logId: log.id,
    taskId: `qr-mock-audio-${log.id}`,
    providerKind: "KIE",
  };
}
