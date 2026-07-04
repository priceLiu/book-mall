import type { GatewayProviderKind } from "@prisma/client";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import {
  MINIMAX_DEFAULT_MUSIC_MODEL_KEY,
  MINIMAX_DEFAULT_SPEECH_MODEL_KEY,
  isMinimaxMusicModelKey,
  resolveMinimaxUpstreamSpeechModel,
} from "@/lib/gateway/minimax-speech-models";
import {
  forwardMinimaxFileUpload,
  forwardMinimaxT2a,
  forwardMinimaxVoiceClone,
  forwardMinimaxVoiceConvert,
} from "@/lib/gateway/minimax-speech-proxy";
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
import {
  generateQrCloneVoiceId,
  normalizeVoiceEmotionWeights,
  resolveDominantVoiceEmotion,
  validateVoiceCloneDraft,
} from "@/lib/quick-replica/qr-voice-clone-models";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";
import { forwardMinimaxMusicGenerate } from "@/lib/gateway/minimax-music-proxy";

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

async function downloadRemoteBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("无法下载音频文件");
  return Buffer.from(await r.arrayBuffer());
}

function guessAudioFilename(url: string, fallbackExt = "mp3"): string {
  const path = url.split("?")[0] ?? url;
  const name = path.split("/").pop();
  if (name && /\.(mp3|m4a|wav)$/i.test(name)) return name;
  return `audio.${fallbackExt}`;
}

export async function qrCreateMinimaxVoiceCloneJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind | string }> {
  const validationError = validateVoiceCloneDraft({
    modelKey: draft.modelKey,
    referenceAudioUrl: draft.referenceAudioUrl,
    sourceAudioUrl: draft.sourceAudioUrl,
    prompt: draft.prompt,
  });
  if (validationError) throw new Error(validationError);

  const { auth, credentialId } = await requireMinimaxAuth(userId);
  const modelKey = draft.modelKey.trim() || MINIMAX_DEFAULT_SPEECH_MODEL_KEY;
  const refUrl = (draft.referenceAudioUrl ?? draft.sourceAudioUrl ?? "").trim();
  const refBuffer = await downloadRemoteBuffer(refUrl);
  const refUpload = await forwardMinimaxFileUpload({
    credentialId,
    buffer: refBuffer,
    filename: guessAudioFilename(refUrl),
    purpose: "voice_clone",
  });
  if (!refUpload.fileId) {
    throw new Error("参考音频上传 MiniMax 失败");
  }

  let clonePrompt: { prompt_audio: number; prompt_text: string } | undefined;
  const promptAudioUrl = draft.clonePromptAudioUrl?.trim();
  const promptText = draft.clonePromptText?.trim();
  if (promptAudioUrl && promptText) {
    const promptBuffer = await downloadRemoteBuffer(promptAudioUrl);
    const promptUpload = await forwardMinimaxFileUpload({
      credentialId,
      buffer: promptBuffer,
      filename: guessAudioFilename(promptAudioUrl),
      purpose: "prompt_audio",
    });
    if (!promptUpload.fileId) throw new Error("示例音频上传 MiniMax 失败");
    clonePrompt = { prompt_audio: promptUpload.fileId, prompt_text: promptText };
  }

  const cloneVoiceId = draft.cloneVoiceId?.trim() || generateQrCloneVoiceId();
  const emotions = normalizeVoiceEmotionWeights(draft.voiceEmotions);
  const dominantEmotion = resolveDominantVoiceEmotion(emotions);
  const controls = normalizeVoiceControls(draft);

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: modelKey,
    endpoint: "/v1/voice_clone",
    providerKind: "MINIMAX",
    requestKind: "TTS",
    clientSource: CLIENT_SOURCE,
    clientPage: "quick-replica/voice-clone",
    actorBookUserId: userId,
    inputSummary: {
      qrVoiceClone: {
        draft: { ...draft, cloneVoiceId },
        referenceFileId: refUpload.fileId,
      },
    },
  });

  const result = await forwardMinimaxVoiceClone({
    credentialId,
    input: {
      file_id: refUpload.fileId,
      voice_id: cloneVoiceId,
      text: draft.prompt.trim(),
      model: resolveMinimaxUpstreamSpeechModel(modelKey),
      language_boost: draft.languageBoost?.trim() || "auto",
      clone_prompt: clonePrompt,
      text_validation: draft.textValidation?.trim(),
      accuracy: draft.accuracy,
      need_noise_reduction: draft.needNoiseReduction ?? false,
      need_volume_normalization: draft.needVolumeNormalization ?? false,
      aigc_watermark: draft.aigcWatermark ?? false,
      voice_setting: {
        voice_id: cloneVoiceId,
        emotion: dominantEmotion,
        speed: controls.voiceSpeed,
        vol: controls.voiceVolume,
        pitch: controls.voicePitch,
      },
    },
  });

  const baseResp = (result.vendorJson as { base_resp?: { status_msg?: string } })?.base_resp;
  if (result.status < 200 || result.status >= 300) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: result.durationMs,
      failMessage: baseResp?.status_msg ?? "MiniMax 音色复刻失败",
      model: modelKey,
    });
    throw new Error(baseResp?.status_msg ?? "MiniMax 音色复刻失败");
  }

  let audioUrl = result.demoAudioUrl?.trim() ?? "";
  if (!audioUrl) {
    const t2a = await forwardMinimaxT2a({
      credentialId,
      input: {
        modelKey,
        text: draft.prompt.trim(),
        voice_id: cloneVoiceId,
        speed: controls.voiceSpeed,
        vol: controls.voiceVolume,
        pitch: controls.voicePitch,
      },
    });
    if (t2a.status >= 200 && t2a.status < 300 && t2a.buffer.length) {
      audioUrl = await uploadAudioOutput({
        userId,
        buffer: t2a.buffer,
        ext: t2a.ext,
      });
    }
  } else {
    const demoBuf = await downloadRemoteBuffer(audioUrl);
    audioUrl = await uploadAudioOutput({
      userId,
      buffer: demoBuf,
      ext: "mp3",
    });
  }

  if (!audioUrl) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: result.durationMs,
      failMessage: "复刻成功但未返回试听音频",
      model: modelKey,
    });
    throw new Error("复刻成功但未返回试听音频");
  }

  await finalizeRequestLog(log.id, {
    status: "SUCCEEDED",
    durationMs: result.durationMs,
    resultSummary: {
      audio_url: audioUrl,
      url: audioUrl,
      voice_id: cloneVoiceId,
      demo_audio: audioUrl,
    },
    model: modelKey,
  });

  return { logId: log.id, taskId: log.id, providerKind: "MINIMAX" };
}

export async function qrCreateTextToAudioJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind | string }> {
  if (draft.kind === "voice-clone") {
    return qrCreateMinimaxVoiceCloneJob(userId, draft);
  }
  if (draft.kind === "voice-changer") {
    return qrCreateMinimaxVoiceConvertJob(userId, draft);
  }
  if (draft.kind === "create-music") {
    return qrCreateMinimaxMusicJob(userId, draft);
  }
  return qrCreateMinimaxTtsJob(userId, draft);
}
