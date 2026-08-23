/** Pro2 音频节点 · Gateway 同步 TTS（/audio/speech · 百炼 Qwen3 / OpenAI 兼容） */
export const PRO2_GATEWAY_SYNC_TTS_MODEL_KEYS = [
  "qwen3-tts",
  "tts-1",
  "tts-1-hd",
] as const;

const GATEWAY_SYNC_TTS_SET = new Set<string>(PRO2_GATEWAY_SYNC_TTS_MODEL_KEYS);

export function isPro2GatewaySyncTtsModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return GATEWAY_SYNC_TTS_SET.has(k);
}
