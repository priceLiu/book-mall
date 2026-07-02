import {
  getQrAudioModelDef,
  getQrAudioVoiceDef,
  QR_AUDIO_VOICE_CONTROL_DEFAULTS,
} from "@/lib/quick-replica/qr-audio-catalog";

export const QR_TEXT_TO_AUDIO_PROMPT_MAX_LENGTH = 10_000;

export function validateTextToAudioDraft(args: {
  modelKey: string;
  voiceId?: string;
  prompt: string;
}): string | null {
  const prompt = args.prompt.trim();
  if (!prompt) return "请填写提示词";
  if (prompt.length > QR_TEXT_TO_AUDIO_PROMPT_MAX_LENGTH) {
    return `提示词最多 ${QR_TEXT_TO_AUDIO_PROMPT_MAX_LENGTH} 字`;
  }
  getQrAudioModelDef(args.modelKey);
  if (args.voiceId?.trim()) {
    getQrAudioVoiceDef(args.voiceId);
  }
  return null;
}

export function clampVoiceControl(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeVoiceControls(input: {
  voiceSpeed?: number;
  voiceStability?: number;
  voiceSimilarityBoost?: number;
  voiceStyleExaggeration?: number;
}) {
  return {
    voiceSpeed: clampVoiceControl(
      input.voiceSpeed ?? QR_AUDIO_VOICE_CONTROL_DEFAULTS.voiceSpeed,
      0.5,
      2,
    ),
    voiceStability: clampVoiceControl(
      input.voiceStability ?? QR_AUDIO_VOICE_CONTROL_DEFAULTS.voiceStability,
      0,
      1,
    ),
    voiceSimilarityBoost: clampVoiceControl(
      input.voiceSimilarityBoost ?? QR_AUDIO_VOICE_CONTROL_DEFAULTS.voiceSimilarityBoost,
      0,
      1,
    ),
    voiceStyleExaggeration: clampVoiceControl(
      input.voiceStyleExaggeration ?? QR_AUDIO_VOICE_CONTROL_DEFAULTS.voiceStyleExaggeration,
      0,
      1,
    ),
  };
}
