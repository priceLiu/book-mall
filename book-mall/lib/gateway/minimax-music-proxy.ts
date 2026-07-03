/**
 * MiniMax 音乐 OpenAPI 代理
 */

import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import {
  resolveMinimaxUpstreamMusicModel,
  isMinimaxMusicModelKey,
} from "@/lib/gateway/minimax-speech-models";
import {
  resolveMinimaxApiRoot,
  minimaxAuthHeaders,
} from "@/lib/gateway/minimax-speech-proxy";

export { isMinimaxMusicModelKey };

export type MinimaxMusicGenerateInput = {
  modelKey: string;
  prompt: string;
  lyrics?: string;
  durationSeconds?: number;
};

export async function forwardMinimaxMusicGenerate(args: {
  credentialId: string;
  input: MinimaxMusicGenerateInput;
  baseUrlOverride?: string | null;
}): Promise<{
  status: number;
  taskId?: string;
  buffer?: Buffer;
  audioUrl?: string;
  durationMs: number;
  vendorJson: unknown;
}> {
  const cred = await getDecryptedCredentialApiKey(args.credentialId);
  if (!cred) throw new Error("MiniMax 凭证不可用");

  const root = resolveMinimaxApiRoot(args.baseUrlOverride || cred.baseUrl);
  const url = `${root}/v1/music_generation`;
  const started = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: minimaxAuthHeaders(cred.apiKey),
    body: JSON.stringify({
      model: resolveMinimaxUpstreamMusicModel(args.input.modelKey),
      prompt: args.input.prompt.trim(),
      ...(args.input.lyrics?.trim() ? { lyrics: args.input.lyrics.trim() } : {}),
      ...(args.input.durationSeconds ? { duration: args.input.durationSeconds } : {}),
    }),
  });
  const json = (await r.json()) as Record<string, unknown>;
  const data = json.data as Record<string, unknown> | undefined;
  const taskId =
    typeof data?.task_id === "string"
      ? data.task_id
      : typeof json.task_id === "string"
        ? json.task_id
        : undefined;
  const audioUrl =
    typeof data?.audio === "string" && data.audio.startsWith("http")
      ? data.audio
      : typeof data?.audio_url === "string"
        ? data.audio_url
        : undefined;

  let buffer: Buffer | undefined;
  if (audioUrl) {
    const dl = await fetch(audioUrl);
    if (dl.ok) buffer = Buffer.from(await dl.arrayBuffer());
  }

  return {
    status: r.status,
    taskId,
    buffer,
    audioUrl,
    durationMs: Date.now() - started,
    vendorJson: json,
  };
}

export async function forwardMinimaxMusicLyrics(args: {
  credentialId: string;
  prompt: string;
  baseUrlOverride?: string | null;
}): Promise<{ status: number; lyrics: string; durationMs: number; vendorJson: unknown }> {
  const cred = await getDecryptedCredentialApiKey(args.credentialId);
  if (!cred) throw new Error("MiniMax 凭证不可用");

  const root = resolveMinimaxApiRoot(args.baseUrlOverride || cred.baseUrl);
  const url = `${root}/v1/lyrics_generation`;
  const started = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: minimaxAuthHeaders(cred.apiKey),
    body: JSON.stringify({ prompt: args.prompt.trim() }),
  });
  const json = (await r.json()) as Record<string, unknown>;
  const data = json.data as Record<string, unknown> | undefined;
  const lyrics =
    typeof data?.lyrics === "string"
      ? data.lyrics
      : typeof json.lyrics === "string"
        ? json.lyrics
        : "";

  return {
    status: r.status,
    lyrics,
    durationMs: Date.now() - started,
    vendorJson: json,
  };
}

export async function forwardMinimaxMusicCoverPreprocess(args: {
  credentialId: string;
  audioUrl: string;
  baseUrlOverride?: string | null;
}): Promise<{ status: number; processedUrl?: string; durationMs: number; vendorJson: unknown }> {
  const cred = await getDecryptedCredentialApiKey(args.credentialId);
  if (!cred) throw new Error("MiniMax 凭证不可用");

  const root = resolveMinimaxApiRoot(args.baseUrlOverride || cred.baseUrl);
  const url = `${root}/v1/cover_preprocess`;
  const started = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: minimaxAuthHeaders(cred.apiKey),
    body: JSON.stringify({ audio_url: args.audioUrl }),
  });
  const json = (await r.json()) as Record<string, unknown>;
  const data = json.data as Record<string, unknown> | undefined;
  const processedUrl =
    typeof data?.audio_url === "string"
      ? data.audio_url
      : typeof data?.processed_url === "string"
        ? data.processed_url
        : undefined;

  return {
    status: r.status,
    processedUrl,
    durationMs: Date.now() - started,
    vendorJson: json,
  };
}
