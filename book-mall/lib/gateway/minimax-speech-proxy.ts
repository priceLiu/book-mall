/**
 * MiniMax OpenAPI 语音代理（api.minimaxi.com）
 * @see docs/minimax.md
 */

import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { resolveMinimaxUpstreamSpeechModel } from "@/lib/gateway/minimax-speech-models";

export const MINIMAX_DEFAULT_API_ROOT = "https://api.minimaxi.com";

export type MinimaxVoiceSetting = {
  voice_id: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  emotion?: string;
};

export type MinimaxT2aInput = {
  modelKey: string;
  text: string;
  voice_id: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  stability?: number;
  similarity_boost?: number;
  style_exaggeration?: number;
  output_format?: "mp3" | "wav" | "pcm";
};

export type MinimaxVoiceCloneInput = {
  file_id: number;
  voice_id: string;
  text?: string;
  model?: string;
  language_boost?: string;
  clone_prompt?: { prompt_audio: number; prompt_text: string };
  text_validation?: string;
  accuracy?: number;
  need_noise_reduction?: boolean;
  need_volume_normalization?: boolean;
  aigc_watermark?: boolean;
  voice_setting?: {
    voice_id: string;
    emotion?: string;
    speed?: number;
    vol?: number;
    pitch?: number;
  };
};

export type MinimaxFileUploadPurpose = "voice_clone" | "prompt_audio";

export type MinimaxSystemVoice = {
  voice_id: string;
  voice_name?: string;
  description?: string[];
  language?: string;
};

export function resolveMinimaxApiRoot(baseUrl?: string | null): string {
  const raw = (baseUrl?.trim() || MINIMAX_DEFAULT_API_ROOT).replace(/\/$/, "");
  if (!raw) return MINIMAX_DEFAULT_API_ROOT;
  if (raw.endsWith("/v1")) return raw.slice(0, -3);
  return raw;
}

export function minimaxAuthHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

function parseT2aAudioBuffer(json: Record<string, unknown>): Buffer | null {
  const data = json.data;
  if (data && typeof data === "object") {
    const audio = (data as Record<string, unknown>).audio;
    if (typeof audio === "string" && audio.length > 0) {
      try {
        return Buffer.from(audio, "hex");
      } catch {
        /* fall through */
      }
      try {
        return Buffer.from(audio, "base64");
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function forwardMinimaxT2a(args: {
  credentialId: string;
  input: MinimaxT2aInput;
  baseUrlOverride?: string | null;
}): Promise<{
  status: number;
  buffer: Buffer;
  durationMs: number;
  contentType: string;
  ext: string;
  vendorJson?: unknown;
  audioUrl?: string;
}> {
  const cred = await getDecryptedCredentialApiKey(args.credentialId);
  if (!cred) throw new Error("MiniMax 凭证不可用");

  const root = resolveMinimaxApiRoot(args.baseUrlOverride || cred.baseUrl);
  const url = `${root}/v1/t2a_v2`;
  const model = resolveMinimaxUpstreamSpeechModel(args.input.modelKey);
  const text = args.input.text.trim();
  if (!text) {
    return {
      status: 400,
      buffer: Buffer.from("text required"),
      durationMs: 0,
      contentType: "text/plain",
      ext: "txt",
    };
  }

  const voiceSetting: Record<string, unknown> = {
    voice_id: args.input.voice_id,
    speed: args.input.speed ?? 1,
    vol: args.input.vol ?? 1,
    pitch: args.input.pitch ?? 0,
  };

  const body: Record<string, unknown> = {
    model,
    text: text.slice(0, 10_000),
    voice_setting: voiceSetting,
    audio_setting: {
      format: args.input.output_format ?? "mp3",
      sample_rate: 32000,
    },
  };

  const started = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: minimaxAuthHeaders(cred.apiKey),
    body: JSON.stringify(body),
  });
  const rawText = await r.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return {
      status: r.status,
      buffer: Buffer.from(rawText.slice(0, 2000)),
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
    };
  }

  const baseResp = json.base_resp as { status_code?: number; status_msg?: string } | undefined;
  if (baseResp && baseResp.status_code !== 0 && baseResp.status_code !== undefined) {
    return {
      status: 502,
      buffer: Buffer.from(baseResp.status_msg ?? "MiniMax TTS failed"),
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
      vendorJson: json,
    };
  }

  let buffer = parseT2aAudioBuffer(json);
  let audioUrl: string | undefined;
  const data = json.data as Record<string, unknown> | undefined;
  if (!buffer && data && typeof data.audio === "string" && data.audio.startsWith("http")) {
    audioUrl = data.audio;
    const dl = await fetch(audioUrl);
    if (dl.ok) buffer = Buffer.from(await dl.arrayBuffer());
  }

  if (!buffer || buffer.length === 0) {
    return {
      status: 502,
      buffer: Buffer.from("MiniMax TTS: empty audio"),
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
      vendorJson: json,
    };
  }

  const ext = args.input.output_format === "wav" ? "wav" : "mp3";
  return {
    status: 200,
    buffer,
    durationMs: Date.now() - started,
    contentType: ext === "wav" ? "audio/wav" : "audio/mpeg",
    ext,
    vendorJson: json,
    audioUrl,
  };
}

export async function forwardMinimaxFileUpload(args: {
  credentialId: string;
  buffer: Buffer;
  filename: string;
  purpose: MinimaxFileUploadPurpose;
  baseUrlOverride?: string | null;
}): Promise<{
  status: number;
  fileId: number;
  vendorJson: unknown;
  durationMs: number;
}> {
  const cred = await getDecryptedCredentialApiKey(args.credentialId);
  if (!cred) throw new Error("MiniMax 凭证不可用");

  const root = resolveMinimaxApiRoot(args.baseUrlOverride || cred.baseUrl);
  const url = `${root}/v1/files/upload`;
  const started = Date.now();

  const form = new FormData();
  form.append("purpose", args.purpose);
  form.append("file", new Blob([new Uint8Array(args.buffer)]), args.filename);

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cred.apiKey}`,
    },
    body: form,
  });

  const json = (await r.json()) as Record<string, unknown>;
  const baseResp = json.base_resp as { status_code?: number; status_msg?: string } | undefined;
  const file = json.file as { file_id?: number } | undefined;
  const fileId = typeof file?.file_id === "number" ? file.file_id : 0;

  if (!fileId || (baseResp && baseResp.status_code !== 0 && baseResp.status_code !== undefined)) {
    return {
      status: r.status >= 400 ? r.status : 502,
      fileId: 0,
      vendorJson: json,
      durationMs: Date.now() - started,
    };
  }

  return {
    status: r.status,
    fileId,
    vendorJson: json,
    durationMs: Date.now() - started,
  };
}

export async function forwardMinimaxVoiceClone(args: {
  credentialId: string;
  input: MinimaxVoiceCloneInput;
  baseUrlOverride?: string | null;
}): Promise<{
  status: number;
  demoAudioUrl?: string;
  clonedVoiceId: string;
  vendorJson: unknown;
  durationMs: number;
}> {
  const cred = await getDecryptedCredentialApiKey(args.credentialId);
  if (!cred) throw new Error("MiniMax 凭证不可用");

  const root = resolveMinimaxApiRoot(args.baseUrlOverride || cred.baseUrl);
  const url = `${root}/v1/voice_clone`;
  const started = Date.now();

  const body: Record<string, unknown> = {
    file_id: args.input.file_id,
    voice_id: args.input.voice_id,
  };
  if (args.input.text?.trim()) body.text = args.input.text.trim().slice(0, 1000);
  if (args.input.model) body.model = args.input.model;
  if (args.input.language_boost) body.language_boost = args.input.language_boost;
  if (args.input.clone_prompt) body.clone_prompt = args.input.clone_prompt;
  if (args.input.text_validation?.trim()) body.text_validation = args.input.text_validation.trim();
  if (args.input.accuracy != null && args.input.accuracy > 0) body.accuracy = args.input.accuracy;
  if (args.input.need_noise_reduction != null) {
    body.need_noise_reduction = args.input.need_noise_reduction;
  }
  if (args.input.need_volume_normalization != null) {
    body.need_volume_normalization = args.input.need_volume_normalization;
  }
  if (args.input.aigc_watermark != null) body.aigc_watermark = args.input.aigc_watermark;
  if (args.input.voice_setting) body.voice_setting = args.input.voice_setting;

  const r = await fetch(url, {
    method: "POST",
    headers: minimaxAuthHeaders(cred.apiKey),
    body: JSON.stringify(body),
  });

  const json = (await r.json()) as Record<string, unknown>;
  const baseResp = json.base_resp as { status_code?: number; status_msg?: string } | undefined;
  const demoAudio =
    typeof json.demo_audio === "string" && json.demo_audio.startsWith("http")
      ? json.demo_audio
      : undefined;

  if (baseResp && baseResp.status_code !== 0 && baseResp.status_code !== undefined) {
    return {
      status: 502,
      clonedVoiceId: args.input.voice_id,
      vendorJson: json,
      durationMs: Date.now() - started,
    };
  }

  return {
    status: r.status,
    demoAudioUrl: demoAudio,
    clonedVoiceId: args.input.voice_id,
    vendorJson: json,
    durationMs: Date.now() - started,
  };
}

export async function forwardMinimaxGetVoice(args: {
  credentialId: string;
  voiceType?: "system" | "voice_cloning" | "voice_generation" | "all";
  baseUrlOverride?: string | null;
}): Promise<{
  status: number;
  systemVoice: MinimaxSystemVoice[];
  vendorJson: unknown;
  durationMs: number;
}> {
  const cred = await getDecryptedCredentialApiKey(args.credentialId);
  if (!cred) throw new Error("MiniMax 凭证不可用");

  const root = resolveMinimaxApiRoot(args.baseUrlOverride || cred.baseUrl);
  const url = `${root}/v1/get_voice`;
  const started = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: minimaxAuthHeaders(cred.apiKey),
    body: JSON.stringify({ voice_type: args.voiceType ?? "system" }),
  });
  const json = (await r.json()) as Record<string, unknown>;
  const systemRaw = json.system_voice;
  const systemVoice: MinimaxSystemVoice[] = Array.isArray(systemRaw)
    ? systemRaw
        .filter((v): v is Record<string, unknown> => v && typeof v === "object")
        .map((v) => ({
          voice_id: String(v.voice_id ?? ""),
          voice_name: typeof v.voice_name === "string" ? v.voice_name : undefined,
          description: Array.isArray(v.description)
            ? v.description.filter((d): d is string => typeof d === "string")
            : undefined,
        }))
        .filter((v) => v.voice_id)
    : [];

  return {
    status: r.status,
    systemVoice,
    vendorJson: json,
    durationMs: Date.now() - started,
  };
}

export async function forwardMinimaxVoiceConvert(args: {
  credentialId: string;
  modelKey: string;
  sourceAudioUrl: string;
  voice_id: string;
  stability?: number;
  similarity_boost?: number;
  style_exaggeration?: number;
  baseUrlOverride?: string | null;
}): Promise<{
  status: number;
  buffer: Buffer;
  durationMs: number;
  contentType: string;
  ext: string;
  vendorJson?: unknown;
}> {
  const cred = await getDecryptedCredentialApiKey(args.credentialId);
  if (!cred) throw new Error("MiniMax 凭证不可用");

  const root = resolveMinimaxApiRoot(args.baseUrlOverride || cred.baseUrl);
  const url = `${root}/v1/voice_conversion`;
  const started = Date.now();

  const r = await fetch(url, {
    method: "POST",
    headers: minimaxAuthHeaders(cred.apiKey),
    body: JSON.stringify({
      model: resolveMinimaxUpstreamSpeechModel(args.modelKey),
      audio_url: args.sourceAudioUrl,
      voice_id: args.voice_id,
      voice_setting: {
        stability: args.stability ?? 0.5,
        similarity_boost: args.similarity_boost ?? 0.75,
        style_exaggeration: args.style_exaggeration ?? 0,
      },
    }),
  });

  const rawText = await r.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return {
      status: r.status,
      buffer: Buffer.from(rawText.slice(0, 2000)),
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
    };
  }

  let buffer = parseT2aAudioBuffer(json);
  const data = json.data as Record<string, unknown> | undefined;
  if (!buffer && data && typeof data.audio === "string" && data.audio.startsWith("http")) {
    const dl = await fetch(data.audio);
    if (dl.ok) buffer = Buffer.from(await dl.arrayBuffer());
  }

  if (!buffer?.length) {
    return {
      status: r.status >= 400 ? r.status : 502,
      buffer: Buffer.from("MiniMax voice conversion failed"),
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
      vendorJson: json,
    };
  }

  return {
    status: 200,
    buffer,
    durationMs: Date.now() - started,
    contentType: "audio/mpeg",
    ext: "mp3",
    vendorJson: json,
  };
}

export function isMinimaxSpeechRouteModel(model: string): boolean {
  const m = model.trim().toLowerCase();
  return (
    m.startsWith("minimax/speech-") ||
    m.startsWith("speech-2") ||
    m === "minimax_speech_02"
  );
}
