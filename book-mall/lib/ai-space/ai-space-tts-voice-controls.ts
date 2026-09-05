import { MINIMAX_TTS_EMOTION_OPTIONS } from "@/lib/gateway/minimax-tts-emotion-options";

/** MiniMax T2A emotion · 与画布 Dock / Gateway 一致 */
export const AI_SPACE_TTS_EMOTION_OPTIONS = MINIMAX_TTS_EMOTION_OPTIONS.map(
  (o) => ({
    id: o.value,
    label: o.value === "" ? "默认（跟随音色）" : o.label,
  }),
) as ReadonlyArray<{ id: string; label: string }>;

export type AiSpaceTtsVoiceControls = {
  emotion: string | null;
  speed: number;
  volume: number;
  pitch: number;
};

export const AI_SPACE_TTS_VOICE_CONTROL_DEFAULTS: AiSpaceTtsVoiceControls = {
  emotion: null,
  speed: 1,
  volume: 1,
  pitch: 0,
};

function clampVoiceControl(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAiSpaceTtsVoiceControls(input: {
  speed?: number;
  volume?: number;
  pitch?: number;
}): Pick<AiSpaceTtsVoiceControls, "speed" | "volume" | "pitch"> {
  const d = AI_SPACE_TTS_VOICE_CONTROL_DEFAULTS;
  const speed = clampVoiceControl(input.speed ?? d.speed, 0.5, 2);
  const volume = clampVoiceControl(input.volume ?? d.volume, 0, 2);
  const pitch = Math.round(clampVoiceControl(input.pitch ?? d.pitch, -12, 12));
  return { speed, volume, pitch };
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** 仅服务端 API 使用；勿从 client 组件 import 本函数以外的 quick-replica 链 */
export function parseAiSpaceTtsVoiceControls(
  body: Record<string, unknown>,
): AiSpaceTtsVoiceControls {
  const normalized = normalizeAiSpaceTtsVoiceControls({
    speed: readOptionalNumber(body.speed),
    volume: readOptionalNumber(body.volume ?? body.vol),
    pitch: readOptionalNumber(body.pitch),
  });
  const emotionRaw = typeof body.emotion === "string" ? body.emotion.trim() : "";
  const allowed = new Set<string>(
    AI_SPACE_TTS_EMOTION_OPTIONS.map((o) => o.id).filter(Boolean),
  );
  const emotion = emotionRaw && allowed.has(emotionRaw) ? emotionRaw : null;
  return {
    emotion,
    ...normalized,
  };
}
