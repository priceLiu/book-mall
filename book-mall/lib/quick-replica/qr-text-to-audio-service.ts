import type { GatewayProviderKind } from "@prisma/client";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import {
  forwardMinimaxT2a,
  forwardMinimaxVoiceConvert,
} from "@/lib/gateway/minimax-speech-proxy";
import { forwardMinimaxMusicGenerate } from "@/lib/gateway/minimax-music-proxy";
import {
  MINIMAX_DEFAULT_MUSIC_MODEL_KEY,
  MINIMAX_DEFAULT_SPEECH_MODEL_KEY,
  isMinimaxMusicModelKey,
} from "@/lib/gateway/minimax-speech-models";
import {
  createRequestLog,
  finalizeRequestLog,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import {
  getQrAudioVoiceDef,
  QR_DEFAULT_AUDIO_MODEL_KEY,
} from "@/lib/quick-replica/qr-audio-catalog";
import {
  normalizeVoiceControls,
  validateTextToAudioDraft,
  validateVoiceChangerDraft,
} from "@/lib/quick-replica/qr-text-to-audio-models";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

const CLIENT_SOURCE = "QUICK_REPLICA" as const;

async function requireMinimaxAuth(userId: string) {
  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心关联 Gateway API Key");
  }
  const credentialId = pickCredentialForKind(auth.credentials, "MINIMAX");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 MiniMax 凭证");
  }
  return { auth, credentialId };
}

async function uploadAudioOutput(args: {
  userId: string;
  buffer: Buffer;
  ext: string;
}): Promise<string> {
  return uploadCanvasUserBuffer({
    userId: args.userId,
    buf: args.buffer,
    contentType: args.ext === "wav" ? "audio/wav" : "audio/mpeg",
    ext: args.ext,
    preferBucketUrl: true,
  });
}

export async function qrCreateMinimaxTtsJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind | string }> {
  const validationError = validateTextToAudioDraft({
    modelKey: draft.modelKey,
    voiceId: draft.voiceId,
    prompt: draft.prompt,
  });
  if (validationError) throw new Error(validationError);

  const { auth, credentialId } = await requireMinimaxAuth(userId);
  const controls = normalizeVoiceControls(draft);
  const modelKey = draft.modelKey.trim() || QR_DEFAULT_AUDIO_MODEL_KEY;
  const voiceId = draft.voiceId?.trim() || getQrAudioVoiceDef("").voiceId;

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: modelKey,
    endpoint: "/v1/t2a_v2",
    providerKind: "MINIMAX",
    requestKind: "TTS",
    clientSource: CLIENT_SOURCE,
    clientPage: `quick-replica/${draft.kind}`,
    actorBookUserId: userId,
    inputSummary: {
      qrTextToAudio: { draft, voiceControls: controls },
    },
  });

  const result = await forwardMinimaxT2a({
    credentialId,
    input: {
      modelKey,
      text: draft.prompt.trim(),
      voice_id: voiceId,
      speed: controls.voiceSpeed,
      vol: controls.voiceVolume,
      pitch: controls.voicePitch,
    },
  });

  const ok = result.status >= 200 && result.status < 300;
  if (!ok) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: result.durationMs,
      failMessage: result.buffer.toString("utf8").slice(0, 500),
      model: modelKey,
    });
    throw new Error(result.buffer.toString("utf8").slice(0, 200) || "MiniMax TTS 失败");
  }

  const audioUrl = await uploadAudioOutput({
    userId,
    buffer: result.buffer,
    ext: result.ext,
  });

  await finalizeRequestLog(log.id, {
    status: "SUCCEEDED",
    durationMs: result.durationMs,
    resultSummary: { audio_url: audioUrl, url: audioUrl },
    model: modelKey,
  });

  return { logId: log.id, taskId: log.id, providerKind: "MINIMAX" };
}

export async function qrCreateMinimaxVoiceConvertJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind | string }> {
  const validationError = validateVoiceChangerDraft({
    modelKey: draft.modelKey,
    voiceId: draft.voiceId,
    sourceAudioUrl: draft.sourceAudioUrl ?? draft.referenceAudioUrl,
  });
  if (validationError) throw new Error(validationError);

  const { auth, credentialId } = await requireMinimaxAuth(userId);
  const controls = normalizeVoiceControls(draft);
  const modelKey = draft.modelKey.trim() || MINIMAX_DEFAULT_SPEECH_MODEL_KEY;
  const sourceAudioUrl = (draft.sourceAudioUrl ?? draft.referenceAudioUrl ?? "").trim();
  const voiceId = draft.voiceId!.trim();

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: modelKey,
    endpoint: "/v1/voice_conversion",
    providerKind: "MINIMAX",
    requestKind: "TTS",
    clientSource: CLIENT_SOURCE,
    clientPage: "quick-replica/voice-changer",
    actorBookUserId: userId,
    inputSummary: { qrVoiceChanger: { draft } },
  });

  const result = await forwardMinimaxVoiceConvert({
    credentialId,
    modelKey,
    sourceAudioUrl,
    voice_id: voiceId,
    stability: controls.voiceStability,
    similarity_boost: controls.voiceSimilarityBoost,
    style_exaggeration: controls.voiceStyleExaggeration,
  });

  const ok = result.status >= 200 && result.status < 300;
  if (!ok) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: result.durationMs,
      failMessage: result.buffer.toString("utf8").slice(0, 500),
      model: modelKey,
    });
    throw new Error("MiniMax 变声失败");
  }

  const audioUrl = await uploadAudioOutput({
    userId,
    buffer: result.buffer,
    ext: result.ext,
  });

  await finalizeRequestLog(log.id, {
    status: "SUCCEEDED",
    durationMs: result.durationMs,
    resultSummary: { audio_url: audioUrl, url: audioUrl },
    model: modelKey,
  });

  return { logId: log.id, taskId: log.id, providerKind: "MINIMAX" };
}

export async function qrCreateMinimaxMusicJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind | string }> {
  const prompt = draft.prompt.trim();
  if (!prompt) throw new Error("请填写音乐描述或歌词");

  const { auth, credentialId } = await requireMinimaxAuth(userId);
  const modelKey =
    draft.modelKey.trim() ||
    (isMinimaxMusicModelKey(draft.modelKey) ? draft.modelKey : MINIMAX_DEFAULT_MUSIC_MODEL_KEY);

  routeGatewayModel(modelKey);

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: modelKey,
    endpoint: "/v1/music_generation",
    providerKind: "MINIMAX",
    requestKind: "MUSIC",
    clientSource: CLIENT_SOURCE,
    clientPage: "quick-replica/create-music",
    actorBookUserId: userId,
    inputSummary: { qrCreateMusic: { draft } },
  });

  const result = await forwardMinimaxMusicGenerate({
    credentialId,
    input: {
      modelKey,
      prompt,
      lyrics: draft.musicMode === "cover" ? draft.prompt : undefined,
      durationSeconds: draft.duration,
    },
  });

  if (!result.buffer?.length) {
    await finalizeRequestLog(log.id, {
      status: result.taskId ? "RUNNING" : "FAILED",
      durationMs: result.durationMs,
      externalTaskId: result.taskId,
      failMessage: result.taskId ? undefined : "MiniMax 音乐生成失败",
      model: modelKey,
    });
    if (result.taskId) {
      return { logId: log.id, taskId: result.taskId, providerKind: "MINIMAX" };
    }
    throw new Error("MiniMax 音乐生成失败");
  }

  const audioUrl = await uploadAudioOutput({
    userId,
    buffer: result.buffer,
    ext: "mp3",
  });

  await finalizeRequestLog(log.id, {
    status: "SUCCEEDED",
    durationMs: result.durationMs,
    externalTaskId: result.taskId,
    resultSummary: { audio_url: audioUrl, url: audioUrl },
    model: modelKey,
  });

  return { logId: log.id, taskId: result.taskId ?? log.id, providerKind: "MINIMAX" };
}

export async function qrCreateTextToAudioJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind | string }> {
  if (draft.kind === "voice-changer") {
    return qrCreateMinimaxVoiceConvertJob(userId, draft);
  }
  if (draft.kind === "create-music") {
    return qrCreateMinimaxMusicJob(userId, draft);
  }
  return qrCreateMinimaxTtsJob(userId, draft);
}
