/**
 * Canvas · MiniMax Speech TTS（与 Gateway MINIMAX_SPEECH_MODELS / AI 空间音频库一致）
 */
import { MINIMAX_SPEECH_MODELS } from "@/lib/gateway/minimax-speech-models";
import type { CanvasModelRole } from "@prisma/client";

export const MINIMAX_SPEECH_KNOWN_MODELS_CANVAS = MINIMAX_SPEECH_MODELS.map((m) => ({
  modelKey: m.modelKey,
  displayName: m.label,
  role: "LLM" as CanvasModelRole,
  description: m.subtitle,
  paramsSchema: null,
  defaultParams: {
    voice_id: "male-qn-qingse",
    speed: 1,
    vol: 1,
    pitch: 0,
  } as Record<string, unknown>,
}));
