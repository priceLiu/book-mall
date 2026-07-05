import type { GatewayProviderKind } from "@prisma/client";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import {
  ELEVENLABS_DEFAULT_MUSIC_MODEL_KEY,
  ELEVENLABS_DEFAULT_SFX_MODEL_KEY,
  ELEVENLABS_DEFAULT_STS_MODEL_KEY,
  ELEVENLABS_DEFAULT_VOICE_ID,
  isElevenLabsStsModelKey,
} from "@/lib/gateway/elevenlabs-models";
import {
  forwardElevenLabsListVoices,
  forwardElevenLabsMusicCompose,
  forwardElevenLabsSoundEffects,
  forwardElevenLabsStsConvert,
} from "@/lib/gateway/elevenlabs-proxy";
import {
  MINIMAX_DEFAULT_SPEECH_MODEL_KEY,
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
  validateSfxDraft,
  validateTextToAudioDraft,
  validateVoiceChangerDraft,
  validateMusicDraft,
} from "@/lib/quick-replica/qr-text-to-audio-models";
import {
  generateQrCloneVoiceId,
  normalizeVoiceEmotionWeights,
  resolveDominantVoiceEmotion,
  validateVoiceCloneDraft,
} from "@/lib/quick-replica/qr-voice-clone-models";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

const CLIENT_SOURCE = "QUICK_REPLICA" as const;

async function requireElevenLabsAuth(userId: string) {
  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心关联 Gateway API Key");
  }
  const credentialId = pickCredentialForKind(auth.credentials, "ELEVENLABS");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 ElevenLabs 凭证");
  }
  return { auth, credentialId };
}

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

export async function qrListElevenLabsVoices(userId: string) {
  const { credentialId } = await requireElevenLabsAuth(userId);
  const result = await forwardElevenLabsListVoices({ credentialId });
  if (result.status < 200 || result.status >= 300) {
    throw new Error("ElevenLabs 音色列表加载失败");
  }
  return result.voices.map((v) => ({
    voiceId: v.voice_id,
    label: v.name,
    subtitle: v.labels?.language ?? v.labels?.accent ?? "ElevenLabs",
    language: v.labels?.language,
    previewUrl: v.preview_url ?? undefined,
    avatarLetter: v.name.charAt(0).toUpperCase() || "V",
    tags: ["elevenlabs"],
  }));
}

export async function qrCreateElevenLabsStsJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind | string }> {
  const validationError = validateVoiceChangerDraft({
    modelKey: draft.modelKey,
    voiceId: draft.voiceId,
    sourceAudioUrl: draft.sourceAudioUrl ?? draft.referenceAudioUrl,
  });
  if (validationError) throw new Error(validationError);

  const { auth, credentialId } = await requireElevenLabsAuth(userId);
  const modelKey = draft.modelKey.trim() || ELEVENLABS_DEFAULT_STS_MODEL_KEY;
  const controls = normalizeVoiceControls(draft);
  const sourceAudioUrl = (draft.sourceAudioUrl ?? draft.referenceAudioUrl ?? "").trim();
  const voiceId = draft.voiceId?.trim() || ELEVENLABS_DEFAULT_VOICE_ID;

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: modelKey,
    endpoint: "/v1/speech-to-speech",
    providerKind: "ELEVENLABS",
    requestKind: "TTS",
    clientSource: CLIENT_SOURCE,
    clientPage: "quick-replica/voice-changer",
    actorBookUserId: userId,
    inputSummary: { qrVoiceChanger: { draft } },
  });

  const result = await forwardElevenLabsStsConvert({
    credentialId,
    modelKey,
    voiceId,
    sourceAudioUrl,
    voiceSettings: {
      stability: controls.voiceStability,
      similarity_boost: controls.voiceSimilarityBoost,
      style: controls.voiceStyleExaggeration,
      use_speaker_boost: true,
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
    throw new Error("ElevenLabs 变声失败");
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

  return { logId: log.id, taskId: log.id, providerKind: "ELEVENLABS" };
}

export async function qrCreateElevenLabsSfxJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind | string }> {
  const validationError = validateSfxDraft({ prompt: draft.prompt });
  if (validationError) throw new Error(validationError);

  const { auth, credentialId } = await requireElevenLabsAuth(userId);
  const modelKey = ELEVENLABS_DEFAULT_SFX_MODEL_KEY;
  const durationAuto = draft.sfxDurationAuto ?? true;
  const durationSeconds = durationAuto
    ? null
    : Math.min(30, Math.max(0.5, draft.sfxDurationSeconds ?? 5));

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: modelKey,
    endpoint: "/v1/sound-generation",
    providerKind: "ELEVENLABS",
    requestKind: "OTHER",
    clientSource: CLIENT_SOURCE,
    clientPage: "quick-replica/create-sfx",
    actorBookUserId: userId,
    inputSummary: { qrSfx: { draft } },
  });

  const result = await forwardElevenLabsSoundEffects({
    credentialId,
    text: draft.prompt.trim(),
    durationSeconds,
    promptInfluence: draft.sfxPromptInfluence ?? 0.3,
    loop: Boolean(draft.sfxLoop),
  });

  const ok = result.status >= 200 && result.status < 300;
  if (!ok) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: result.durationMs,
      failMessage: result.buffer.toString("utf8").slice(0, 500),
      model: modelKey,
    });
    throw new Error("ElevenLabs 音效生成失败");
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

  return { logId: log.id, taskId: log.id, providerKind: "ELEVENLABS" };
}

function buildElevenMusicPrompt(draft: QrWorkspaceDraft): string {
  let prompt = draft.prompt.trim();
  const extras: string[] = [];
  if (!draft.musicBpmAuto && draft.musicBpm != null) {
    extras.push(`BPM: ${Math.round(draft.musicBpm)}`);
  }
  if (!draft.musicKeyAuto && draft.musicKey?.trim()) {
    extras.push(`Key: ${draft.musicKey.trim()}`);
  }
  if (!draft.musicIntensityAuto && draft.musicIntensity?.trim()) {
    extras.push(`Intensity: ${draft.musicIntensity.trim()}`);
  }
  if (extras.length > 0) {
    prompt = `${prompt}\n${extras.join(". ")}.`;
  }
  return prompt;
}

function resolveElevenMusicLengthMs(draft: QrWorkspaceDraft): number | null {
  if ((draft.musicClipMode ?? "quick") === "quick") return 30_000;
  if (draft.musicDurationAuto ?? true) return null;
  const sec = draft.musicDurationSeconds ?? draft.duration ?? 180;
  return Math.min(600, Math.max(3, sec)) * 1000;
}

export async function qrCreateElevenLabsMusicJob(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<{ logId: string; taskId: string; providerKind: GatewayProviderKind | string }> {
  const validationError = validateMusicDraft({ prompt: draft.prompt });
  if (validationError) throw new Error(validationError);

  const { auth, credentialId } = await requireElevenLabsAuth(userId);
  const modelKey = ELEVENLABS_DEFAULT_MUSIC_MODEL_KEY;
  const prompt = buildElevenMusicPrompt(draft);
  const musicLengthMs = resolveElevenMusicLengthMs(draft);

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: modelKey,
    endpoint: "/v1/music",
    providerKind: "ELEVENLABS",
    requestKind: "MUSIC",
    clientSource: CLIENT_SOURCE,
    clientPage: "quick-replica/create-music",
    actorBookUserId: userId,
    inputSummary: { qrCreateMusic: { draft } },
  });

  const result = await forwardElevenLabsMusicCompose({
    credentialId,
    modelKey,
    prompt,
    musicLengthMs,
    forceInstrumental: Boolean(draft.musicInstrumental),
  });

  const ok = result.status >= 200 && result.status < 300;
  if (!ok) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: result.durationMs,
      failMessage: result.buffer.toString("utf8").slice(0, 500),
      model: modelKey,
    });
    throw new Error("ElevenLabs 音乐生成失败");
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

  return { logId: log.id, taskId: log.id, providerKind: "ELEVENLABS" };
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
    if (isElevenLabsStsModelKey(draft.modelKey)) {
      return qrCreateElevenLabsStsJob(userId, draft);
    }
    return qrCreateMinimaxVoiceConvertJob(userId, draft);
  }
  if (draft.kind === "create-sfx") {
    return qrCreateElevenLabsSfxJob(userId, draft);
  }
  if (draft.kind === "create-music") {
    return qrCreateElevenLabsMusicJob(userId, draft);
  }
  return qrCreateMinimaxTtsJob(userId, draft);
}
