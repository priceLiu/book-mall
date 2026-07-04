/**
 * ElevenLabs OpenAPI 代理（变声器 STS · 音效生成 · 音色列表）
 * @see docs/elevenlabs.md
 */

import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import {
  resolveElevenLabsApiRoot,
  resolveElevenLabsUpstreamModel,
} from "@/lib/gateway/elevenlabs-models";

export function elevenLabsAuthHeaders(apiKey: string): Record<string, string> {
  return { "xi-api-key": apiKey };
}

export type ElevenLabsVoiceSummary = {
  voice_id: string;
  name: string;
  preview_url?: string | null;
  labels?: Record<string, string>;
};

export async function forwardElevenLabsListVoices(args: {
  credentialId: string;
  baseUrlOverride?: string | null;
}): Promise<{
  status: number;
  voices: ElevenLabsVoiceSummary[];
  durationMs: number;
  vendorJson?: unknown;
}> {
  const cred = await getDecryptedCredentialApiKey(args.credentialId);
  if (!cred) throw new Error("ElevenLabs 凭证不可用");

  const root = resolveElevenLabsApiRoot(args.baseUrlOverride || cred.baseUrl);
  const started = Date.now();
  const r = await fetch(`${root}/v1/voices`, {
    headers: elevenLabsAuthHeaders(cred.apiKey),
    cache: "no-store",
  });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  const rawList = Array.isArray(json.voices) ? json.voices : [];
  const voices = rawList
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const voice_id = typeof o.voice_id === "string" ? o.voice_id : "";
      const name = typeof o.name === "string" ? o.name : "";
      if (!voice_id || !name) return null;
      return {
        voice_id,
        name,
        preview_url: typeof o.preview_url === "string" ? o.preview_url : null,
        labels:
          o.labels && typeof o.labels === "object"
            ? (o.labels as Record<string, string>)
            : undefined,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return {
    status: r.status,
    voices,
    durationMs: Date.now() - started,
    vendorJson: json,
  };
}

export async function forwardElevenLabsStsConvert(args: {
  credentialId: string;
  modelKey: string;
  voiceId: string;
  sourceAudioUrl: string;
  outputFormat?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
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
  if (!cred) throw new Error("ElevenLabs 凭证不可用");

  const root = resolveElevenLabsApiRoot(args.baseUrlOverride || cred.baseUrl);
  const upstreamModel = resolveElevenLabsUpstreamModel(args.modelKey);
  const voiceId = args.voiceId.trim();
  const started = Date.now();

  const srcRes = await fetch(args.sourceAudioUrl.trim(), { redirect: "follow" });
  if (!srcRes.ok) {
    return {
      status: 502,
      buffer: Buffer.from(`source_audio_fetch_${srcRes.status}`),
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
    };
  }
  const srcBuffer = Buffer.from(await srcRes.arrayBuffer());
  const srcType = srcRes.headers.get("content-type") ?? "audio/mpeg";

  const form = new FormData();
  form.append(
    "audio",
    new Blob([srcBuffer], { type: srcType }),
    srcType.includes("wav") ? "source.wav" : "source.mp3",
  );
  form.append("model_id", upstreamModel);
  form.append("output_format", args.outputFormat ?? "mp3_44100_128");
  if (args.voiceSettings) {
    form.append("voice_settings", JSON.stringify(args.voiceSettings));
  }

  const r = await fetch(`${root}/v1/speech-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: elevenLabsAuthHeaders(cred.apiKey),
    body: form,
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    return {
      status: r.status,
      buffer: Buffer.from(errText.slice(0, 2000) || "elevenlabs_sts_failed"),
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
      vendorJson: errText,
    };
  }

  const buffer = Buffer.from(await r.arrayBuffer());
  return {
    status: r.status,
    buffer,
    durationMs: Date.now() - started,
    contentType: r.headers.get("content-type") ?? "audio/mpeg",
    ext: "mp3",
  };
}

export async function forwardElevenLabsSoundEffects(args: {
  credentialId: string;
  /** Gateway 登记 modelKey；省略则用默认 eleven_text_to_sound_v2 */
  modelKey?: string;
  text: string;
  durationSeconds?: number | null;
  promptInfluence?: number;
  loop?: boolean;
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
  if (!cred) throw new Error("ElevenLabs 凭证不可用");

  const root = resolveElevenLabsApiRoot(args.baseUrlOverride || cred.baseUrl);
  const upstreamModel = args.modelKey?.trim()
    ? resolveElevenLabsUpstreamModel(args.modelKey)
    : "eleven_text_to_sound_v2";
  const started = Date.now();

  const body: Record<string, unknown> = {
    text: args.text.trim(),
    model_id: upstreamModel,
    prompt_influence: args.promptInfluence ?? 0.3,
    loop: Boolean(args.loop),
  };
  if (args.durationSeconds != null && Number.isFinite(args.durationSeconds)) {
    body.duration_seconds = args.durationSeconds;
  }

  const r = await fetch(`${root}/v1/sound-generation`, {
    method: "POST",
    headers: {
      ...elevenLabsAuthHeaders(cred.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    return {
      status: r.status,
      buffer: Buffer.from(errText.slice(0, 2000) || "elevenlabs_sfx_failed"),
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
      vendorJson: errText,
    };
  }

  const buffer = Buffer.from(await r.arrayBuffer());
  return {
    status: r.status,
    buffer,
    durationMs: Date.now() - started,
    contentType: r.headers.get("content-type") ?? "audio/mpeg",
    ext: "mp3",
  };
}

export async function forwardElevenLabsMusicCompose(args: {
  credentialId: string;
  prompt: string;
  musicLengthMs?: number | null;
  forceInstrumental?: boolean;
  modelKey?: string;
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
  if (!cred) throw new Error("ElevenLabs 凭证不可用");

  const root = resolveElevenLabsApiRoot(args.baseUrlOverride || cred.baseUrl);
  const upstreamModel = args.modelKey?.trim()
    ? resolveElevenLabsUpstreamModel(args.modelKey)
    : "music_v2";
  const started = Date.now();

  const body: Record<string, unknown> = {
    prompt: args.prompt.trim(),
    model_id: upstreamModel,
    force_instrumental: Boolean(args.forceInstrumental),
  };
  if (args.musicLengthMs != null && Number.isFinite(args.musicLengthMs)) {
    body.music_length_ms = Math.min(600_000, Math.max(3_000, Math.round(args.musicLengthMs)));
  }

  const r = await fetch(`${root}/v1/music?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      ...elevenLabsAuthHeaders(cred.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    return {
      status: r.status,
      buffer: Buffer.from(errText.slice(0, 2000) || "elevenlabs_music_failed"),
      durationMs: Date.now() - started,
      contentType: "text/plain",
      ext: "txt",
      vendorJson: errText,
    };
  }

  const buffer = Buffer.from(await r.arrayBuffer());
  return {
    status: r.status,
    buffer,
    durationMs: Date.now() - started,
    contentType: r.headers.get("content-type") ?? "audio/mpeg",
    ext: "mp3",
  };
}
