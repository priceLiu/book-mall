/**
 * 百炼 / DashScope · CosyVoice 与 Qwen-Audio-TTS 非实时语音合成
 *
 * 与 qwen-tts-proxy 的 multimodal-generation 路径 **不同**：
 * 本族走 `/api/v1/services/audio/tts/SpeechSynthesizer`，非流式响应回 `output.audio.url`（24h 有效）。
 *
 * @see https://help.aliyun.com/zh/model-studio/cosyvoice-tts-http-api
 */

import type { GatewayProviderKind } from "@prisma/client";

import { getDecryptedCredentialApiKey } from "./credential-service";

const SPEECH_SYNTHESIZER_PATH = "/api/v1/services/audio/tts/SpeechSynthesizer";

/** 该 HTTP 接口支持的模型（文档「取值范围」） */
const COSYVOICE_ROUTE_MODELS = new Set([
  "cosyvoice-v2",
  "cosyvoice-v3-flash",
  "cosyvoice-v3-plus",
  "cosyvoice-v3.5-flash",
  "cosyvoice-v3.5-plus",
  "qwen-audio-3.0-tts-flash",
  "qwen-audio-3.0-tts-plus",
]);

/** CosyVoice 默认系统音色（v3 系列） */
export const COSYVOICE_DEFAULT_VOICE = "longanyang";
export const COSYVOICE_DEFAULT_MODEL_KEY = "cosyvoice-v3-flash";

/** OpenAI /audio/speech 的 voice 名映射到 CosyVoice 系统音色 */
const OPENAI_VOICE_TO_COSYVOICE: Record<string, string> = {
  alloy: "longanyang",
  echo: "longanyang",
  fable: "longanyang",
  onyx: "longanyang",
  nova: "longanyang",
  shimmer: "longanyang",
};

export function isCosyVoiceTtsModel(model: string): boolean {
  const m = model.trim().toLowerCase();
  return COSYVOICE_ROUTE_MODELS.has(m) || m.startsWith("cosyvoice-");
}

function mapVoice(voice: string | undefined): string {
  const v = (voice ?? "").trim();
  if (!v) return COSYVOICE_DEFAULT_VOICE;
  return OPENAI_VOICE_TO_COSYVOICE[v.toLowerCase()] ?? v;
}

export function resolveCosyVoiceSynthesizerUrl(
  baseUrlOverride?: string | null,
): string {
  const raw = (baseUrlOverride ?? "").trim().replace(/\/$/, "");
  // 业务空间专属域名（{WorkspaceId}.cn-beijing.maas.aliyuncs.com）与旧域名都保留 host
  if (/maas\.aliyuncs\.com/i.test(raw) || /dashscope(-intl)?\.aliyuncs\.com/i.test(raw)) {
    const host = raw
      .replace(/\/compatible-mode\/v\d+$/i, "")
      .replace(/\/api\/v1$/i, "")
      .replace(/\/$/, "");
    return `${host}${SPEECH_SYNTHESIZER_PATH}`;
  }
  return `https://dashscope.aliyuncs.com${SPEECH_SYNTHESIZER_PATH}`;
}

type SpeechSynthesizerResponse = {
  request_id?: string;
  output?: {
    finish_reason?: string;
    audio?: { url?: string; data?: string; expires_at?: number };
  };
  usage?: { characters?: number };
  code?: string;
  message?: string;
};

function audioMetaForFormat(format: string): { contentType: string; ext: string } {
  if (format === "mp3") return { contentType: "audio/mpeg", ext: "mp3" };
  if (format === "opus") return { contentType: "audio/opus", ext: "opus" };
  if (format === "pcm") return { contentType: "audio/L16", ext: "pcm" };
  return { contentType: "audio/wav", ext: "wav" };
}

function textFail(status: number, message: string, durationMs: number) {
  return {
    status,
    buffer: Buffer.from(message),
    durationMs,
    contentType: "text/plain",
    ext: "txt",
  };
}

/**
 * 转发一次非流式合成，返回音频 buffer。
 * `opts.body` 兼容 OpenAI `/audio/speech` 形态（`input` / `voice` / `response_format`），
 * 也接受 DashScope 原生的 `text` / `format` / `sample_rate` / `rate` / `pitch` / `instruction`。
 */
export async function forwardCosyVoiceTtsSpeech(opts: {
  credentialId: string;
  providerKind: GatewayProviderKind;
  body: Record<string, unknown>;
  baseUrlOverride?: string | null;
}): Promise<{
  status: number;
  buffer: Buffer;
  durationMs: number;
  contentType: string;
  ext: string;
  vendorJson?: unknown;
}> {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");

  const started = Date.now();
  const modelKey =
    String(opts.body.model ?? COSYVOICE_DEFAULT_MODEL_KEY).trim() ||
    COSYVOICE_DEFAULT_MODEL_KEY;
  const text = String(opts.body.input ?? opts.body.text ?? "").trim();
  if (!text) return textFail(400, "input required", 0);

  const format = String(
    opts.body.format ?? opts.body.response_format ?? "mp3",
  ).toLowerCase();
  const input: Record<string, unknown> = {
    text: text.slice(0, 4096),
    voice: mapVoice(
      typeof opts.body.voice === "string" ? opts.body.voice : undefined,
    ),
    format,
  };
  if (typeof opts.body.sample_rate === "number") {
    input.sample_rate = opts.body.sample_rate;
  }
  if (typeof opts.body.rate === "number") input.rate = opts.body.rate;
  if (typeof opts.body.speed === "number") input.rate = opts.body.speed;
  if (typeof opts.body.pitch === "number") input.pitch = opts.body.pitch;
  if (typeof opts.body.volume === "number") input.volume = opts.body.volume;
  if (typeof opts.body.instruction === "string" && opts.body.instruction.trim()) {
    input.instruction = opts.body.instruction.trim().slice(0, 100);
  }
  if (typeof opts.body.language_hint === "string" && opts.body.language_hint.trim()) {
    input.language_hints = [opts.body.language_hint.trim()];
  }

  const url = resolveCosyVoiceSynthesizerUrl(opts.baseUrlOverride || cred.baseUrl);
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cred.apiKey}`,
    },
    body: JSON.stringify({ model: modelKey, input }),
    signal: AbortSignal.timeout(180_000),
  });

  const raw = Buffer.from(await r.arrayBuffer());
  if (!r.ok) {
    return {
      status: r.status,
      buffer: raw,
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
    };
  }

  let json: SpeechSynthesizerResponse;
  try {
    json = JSON.parse(raw.toString("utf8")) as SpeechSynthesizerResponse;
  } catch {
    return textFail(502, "invalid CosyVoice JSON response", Date.now() - started);
  }

  if (json.code && json.code !== "Success" && json.code !== "200") {
    return textFail(502, json.message ?? json.code, Date.now() - started);
  }

  const audioUrl = json.output?.audio?.url;
  if (typeof audioUrl !== "string" || !/^https?:\/\//.test(audioUrl)) {
    return textFail(
      502,
      "CosyVoice 响应缺少 output.audio.url",
      Date.now() - started,
    );
  }

  const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(120_000) });
  const audioBuf = Buffer.from(await audioRes.arrayBuffer());
  if (!audioRes.ok) {
    return {
      status: audioRes.status,
      buffer: audioBuf,
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
    };
  }

  const meta = audioMetaForFormat(format);
  return {
    status: 200,
    buffer: audioBuf,
    durationMs: Date.now() - started,
    contentType: meta.contentType,
    ext: meta.ext,
    vendorJson: json,
  };
}
