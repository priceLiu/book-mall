/**
 * 我的 AI 空间 · 音频库 TTS 生成（一律经 Gateway，用户 sk-gw 关联的百炼凭证）
 *
 * 生成成功后：OSS 转存 → 写 AiSpaceAudioAsset（originApp=ai-space，originRef=gatewayLogId）。
 */

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { buildGatewayTaskResultSummary } from "@/lib/gateway/log-result-summary";
import {
  createRequestLog,
  finalizeRequestLog,
  forwardAudioSpeech,
  parseOpenAiUsage,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { isCosyVoiceTtsModel } from "@/lib/gateway/cosyvoice-tts-proxy";

import {
  AI_SPACE_TTS_TEXT_MAX,
  getAiSpaceTtsModelDef,
} from "./ai-space-tts-catalog";
import {
  createAiSpaceAudioAsset,
  probeAudioDurationSec,
  type AiSpaceAudioAssetDto,
} from "./ai-space-audio-service";

export class AiSpaceTtsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly logId?: string,
  ) {
    super(message);
    this.name = "AiSpaceTtsError";
  }
}

async function requireBailianAuth(userId: string) {
  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在个人中心关联 Gateway API Key");
  }
  const credentialId = pickCredentialForKind(auth.credentials, "BAILIAN");
  if (!credentialId) {
    throw new GatewayRequiredError(
      "Gateway Key 未绑定百炼（阿里云）凭证，请在 Gateway 模型管理页绑定后重试",
    );
  }
  return { auth, credentialId };
}

/** 生成一条口播音频并入库；失败抛 AiSpaceTtsError（含 logId 便于查 Gateway 日志） */
export async function generateAiSpaceTtsAudio(args: {
  userId: string;
  modelKey: string;
  voice: string;
  text: string;
  name?: string | null;
  /** 方言 / 情感指令（仅 CosyVoice 支持） */
  instruction?: string | null;
}): Promise<AiSpaceAudioAssetDto> {
  const text = args.text.trim();
  if (!text) throw new AiSpaceTtsError("请先填写台词", 400);
  if (text.length > AI_SPACE_TTS_TEXT_MAX) {
    throw new AiSpaceTtsError(`台词最多 ${AI_SPACE_TTS_TEXT_MAX} 字`, 400);
  }

  const def = getAiSpaceTtsModelDef(args.modelKey);
  const modelKey = def.modelKey;
  const voice = args.voice.trim() || def.voices[0]?.id || "";
  const isCosy = isCosyVoiceTtsModel(modelKey);

  const { auth, credentialId } = await requireBailianAuth(args.userId);

  const payload: Record<string, unknown> = {
    model: modelKey,
    input: text,
    voice,
    response_format: "mp3",
    ...(isCosy ? { format: "mp3", sample_rate: 24000 } : {}),
    ...(isCosy && args.instruction?.trim()
      ? { instruction: args.instruction.trim() }
      : {}),
  };

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: modelKey,
    endpoint: isCosy
      ? "/api/v1/services/audio/tts/SpeechSynthesizer"
      : "/services/aigc/multimodal-generation/generation",
    providerKind: "BAILIAN",
    requestKind: "TTS",
    clientSource: "EXTERNAL",
    clientPage: "account/ai-space?tab=audio",
    actorBookUserId: args.userId,
    inputSummary: buildGatewayInputSummary(modelKey, payload),
  });

  const result = await forwardAudioSpeech({
    credentialId,
    providerKind: "BAILIAN",
    body: payload,
  });

  const ok = result.status >= 200 && result.status < 300;
  const usage = result.vendorJson ? parseOpenAiUsage(result.vendorJson) : undefined;
  const failMessage = ok
    ? undefined
    : result.buffer.toString("utf8").slice(0, 500) || `上游服务返回 HTTP ${result.status}`;

  await finalizeRequestLog(log.id, {
    status: ok ? "SUCCEEDED" : "FAILED",
    durationMs: result.durationMs,
    usage,
    resultSummary: ok
      ? buildGatewayTaskResultSummary(result.vendorJson, {
          contentType: result.contentType ?? "audio/mpeg",
          byteLength: result.buffer.length,
        })
      : undefined,
    failCode: ok ? undefined : `UPSTREAM_HTTP_${result.status}`,
    failMessage,
    model: modelKey,
  });

  if (!ok) {
    throw new AiSpaceTtsError(failMessage ?? "语音合成失败", 502, log.id);
  }

  const ext = result.ext ?? "mp3";
  const audioUrl = await uploadCanvasUserBuffer({
    userId: args.userId,
    buf: result.buffer,
    contentType: result.contentType ?? "audio/mpeg",
    ext,
    preferBucketUrl: true,
  });

  const durationSec = await probeAudioDurationSec(result.buffer, ext);
  const fallbackName = text.length > 40 ? `${text.slice(0, 40)}…` : text;

  return createAiSpaceAudioAsset({
    userId: args.userId,
    name: args.name?.trim() || fallbackName,
    sourceType: "tts",
    audioUrl,
    durationSec,
    textScript: text,
    originApp: "ai-space",
    originRef: log.id,
    meta: { modelKey, voice, instruction: args.instruction?.trim() || null },
  });
}
