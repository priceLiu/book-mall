import { createHash } from "node:crypto";

import { resolveMinimaxTtsEmotionForModel } from "@/lib/gateway/minimax-tts-emotion-options";

/** 从 engine.params 读取 TTS 数值（兼容画布持久化后的 string） */
export function readCanvasTtsNumericParam(
  params: Record<string, unknown>,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const raw = params[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

export function resolveCanvasMinimaxTtsVoiceInput(
  params: Record<string, unknown>,
  voiceId: string,
  modelKey: string,
): {
  voice_id: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  emotion?: string;
} {
  const emotion = resolveMinimaxTtsEmotionForModel({
    modelKey,
    emotionRaw: params.emotion,
  });
  return {
    voice_id: voiceId,
    speed: readCanvasTtsNumericParam(params, "speed", "voice_speed"),
    vol: readCanvasTtsNumericParam(params, "vol", "volume", "voice_volume"),
    pitch: readCanvasTtsNumericParam(params, "pitch", "voice_pitch"),
    ...(emotion ? { emotion } : {}),
  };
}

export function resolveCanvasGatewayTtsExtras(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  const speed = readCanvasTtsNumericParam(params, "speed", "voice_speed");
  const pitch = readCanvasTtsNumericParam(params, "pitch", "voice_pitch");
  const volume = readCanvasTtsNumericParam(params, "vol", "volume", "voice_volume");
  if (speed != null) extras.speed = speed;
  if (pitch != null) extras.pitch = pitch;
  if (volume != null) extras.volume = volume;
  const instruction = String(params.instruction ?? "").trim();
  if (instruction) extras.instruction = instruction.slice(0, 500);
  return extras;
}

const TTS_HASH_PARAM_KEYS = [
  "voice_id",
  "voice",
  "speed",
  "vol",
  "pitch",
  "emotion",
  "language_type",
  "instruction",
] as const;

function ttsParamsForInputHash(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of TTS_HASH_PARAM_KEYS) {
    const raw = params[key];
    if (raw === undefined || raw === null || raw === "") continue;
    out[key] = raw;
  }
  return out;
}

/** Pro2 音频 · 任务 inputHash（含 Dock 可调 TTS 参数） */
export function buildPro2AudioTtsInputHash(args: {
  modelKey: string;
  voiceId: string;
  text: string;
  params: Record<string, unknown>;
}): string {
  const payload = {
    modelKey: args.modelKey.trim(),
    voiceId: args.voiceId.trim(),
    text: args.text.trim(),
    params: ttsParamsForInputHash(args.params),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
