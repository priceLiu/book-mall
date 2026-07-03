import {
  getQrAudioModelDef,
  getQrAudioVoiceDef,
  QR_AUDIO_VOICE_CONTROL_DEFAULTS,
} from "@/lib/quick-replica/qr-audio-catalog";
import { findMinimaxVoiceById } from "@/lib/quick-replica/minimax-voice-catalog";

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
    const id = args.voiceId.trim();
    if (!findMinimaxVoiceById(id)) {
      getQrAudioVoiceDef(id);
    }
  }
  return null;
}

export function validateVoiceChangerDraft(args: {
  modelKey: string;
  voiceId?: string;
  sourceAudioUrl?: string;
}): string | null {
  getQrAudioModelDef(args.modelKey);
  if (!args.sourceAudioUrl?.trim()) return "请上传源音频";
  if (!args.voiceId?.trim()) return "请选择目标音色";
  return null;
}

export function clampVoiceControl(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeVoiceControls(input: {
  voiceSpeed?: number;
  voiceVolume?: number;
  voicePitch?: number;
  voiceTone?: number;
  voiceIntensity?: number;
  voiceTimbre?: number;
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
    voiceVolume: clampVoiceControl(
      input.voiceVolume ?? QR_AUDIO_VOICE_CONTROL_DEFAULTS.voiceVolume,
      0,
      2,
    ),
    voicePitch: clampVoiceControl(
      input.voicePitch ?? QR_AUDIO_VOICE_CONTROL_DEFAULTS.voicePitch,
      -12,
      12,
    ),
    voiceTone: clampVoiceControl(
      input.voiceTone ?? QR_AUDIO_VOICE_CONTROL_DEFAULTS.voiceTone,
      0,
      1,
    ),
    voiceIntensity: clampVoiceControl(
      input.voiceIntensity ?? QR_AUDIO_VOICE_CONTROL_DEFAULTS.voiceIntensity,
      0,
      1,
    ),
    voiceTimbre: clampVoiceControl(
      input.voiceTimbre ?? QR_AUDIO_VOICE_CONTROL_DEFAULTS.voiceTimbre,
      0,
      1,
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
