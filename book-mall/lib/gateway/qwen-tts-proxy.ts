/**
 * 百炼 / DashScope · Qwen3-TTS（非 OpenAI /audio/speech，走 multimodal-generation）
 * @see https://help.aliyun.com/zh/model-studio/qwen-tts
 */

import type { GatewayProviderKind } from "@prisma/client";

import { getDecryptedCredentialApiKey } from "./credential-service";

const QWEN_TTS_GENERATION_PATH =
  "/api/v1/services/aigc/multimodal-generation/generation";

const OPENAI_VOICE_TO_QWEN: Record<string, string> = {
  alloy: "Cherry",
  echo: "Ryan",
  fable: "Serena",
  onyx: "Ryan",
  nova: "Cherry",
  shimmer: "Serena",
};

export function isQwenTtsModel(model: string): boolean {
  const m = model.trim().toLowerCase();
  return (
    m === "qwen3-tts" ||
    m.startsWith("qwen3-tts") ||
    m.startsWith("qwen-tts")
  );
}

export function resolveQwenTtsUpstreamModel(modelKey: string): string {
  const m = modelKey.trim().toLowerCase();
  if (m === "qwen3-tts") return "qwen3-tts-flash";
  if (m.startsWith("qwen3-tts-") || m.startsWith("qwen-tts-")) return modelKey.trim();
  return "qwen3-tts-flash";
}

export function mapVoiceToQwen(voice: string | undefined): string {
  const v = (voice ?? "Cherry").trim();
  return OPENAI_VOICE_TO_QWEN[v.toLowerCase()] ?? v;
}

export function detectQwenTtsLanguageType(text: string): "Chinese" | "English" {
  const cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  return cjk && cjk.length >= Math.max(2, text.length * 0.15)
    ? "Chinese"
    : "English";
}

export function resolveDashscopeTtsGenerationUrl(
  baseUrlOverride?: string | null,
): string {
  const raw = (baseUrlOverride ?? "").trim().replace(/\/$/, "");
  if (raw.includes("dashscope-intl.aliyuncs.com")) {
    return `https://dashscope-intl.aliyuncs.com${QWEN_TTS_GENERATION_PATH}`;
  }
  if (raw.includes("dashscope.aliyuncs.com")) {
    const host = raw
      .replace(/\/compatible-mode\/v\d+$/i, "")
      .replace(/\/api\/v1$/i, "")
      .replace(/\/$/, "");
    return `${host}${QWEN_TTS_GENERATION_PATH}`;
  }
  return `https://dashscope.aliyuncs.com${QWEN_TTS_GENERATION_PATH}`;
}

type QwenTtsGenerationResponse = {
  output?: {
    audio?: { url?: string; data?: string };
    finish_reason?: string;
  };
  usage?: Record<string, unknown>;
  code?: string;
  message?: string;
};

function parseAudioUrl(json: QwenTtsGenerationResponse): string | null {
  const url = json.output?.audio?.url;
  return typeof url === "string" && /^https?:\/\//.test(url) ? url : null;
}

function guessAudioMeta(
  url: string,
  buffer: Buffer,
): { contentType: string; ext: string } {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".mp3")) return { contentType: "audio/mpeg", ext: "mp3" };
  if (path.endsWith(".wav")) return { contentType: "audio/wav", ext: "wav" };
  if (buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return { contentType: "audio/mpeg", ext: "mp3" };
  }
  return { contentType: "audio/wav", ext: "wav" };
}

export async function forwardQwenTtsSpeech(opts: {
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

  const modelKey = String(opts.body.model ?? "qwen3-tts");
  const text = String(opts.body.input ?? "").trim();
  if (!text) {
    return {
      status: 400,
      buffer: Buffer.from("input required"),
      durationMs: 0,
      contentType: "text/plain",
      ext: "txt",
    };
  }

  const voice = mapVoiceToQwen(
    typeof opts.body.voice === "string" ? opts.body.voice : undefined,
  );
  const languageType =
    typeof opts.body.language_type === "string"
      ? opts.body.language_type
      : detectQwenTtsLanguageType(text);

  const url = resolveDashscopeTtsGenerationUrl(
    opts.baseUrlOverride || cred.baseUrl,
  );
  const upstreamModel = resolveQwenTtsUpstreamModel(modelKey);

  const started = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cred.apiKey}`,
    },
    body: JSON.stringify({
      model: upstreamModel,
      input: {
        text: text.slice(0, 4096),
        voice,
        language_type: languageType,
      },
    }),
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

  let json: QwenTtsGenerationResponse;
  try {
    json = JSON.parse(raw.toString("utf8")) as QwenTtsGenerationResponse;
  } catch {
    return {
      status: 502,
      buffer: Buffer.from("invalid Qwen TTS JSON response"),
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
    };
  }

  if (json.code && json.code !== "Success" && json.code !== "200") {
    const msg = json.message ?? json.code;
    return {
      status: 502,
      buffer: Buffer.from(msg),
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
    };
  }

  const audioUrl = parseAudioUrl(json);
  if (!audioUrl) {
    return {
      status: 502,
      buffer: Buffer.from("Qwen TTS response missing output.audio.url"),
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
    };
  }

  const audioRes = await fetch(audioUrl);
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

  const meta = guessAudioMeta(audioUrl, audioBuf);
  return {
    status: 200,
    buffer: audioBuf,
    durationMs: Date.now() - started,
    contentType: meta.contentType,
    ext: meta.ext,
    vendorJson: json,
  };
}
