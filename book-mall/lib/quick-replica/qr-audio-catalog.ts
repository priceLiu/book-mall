/** QuickReplica 声音 · MiniMax Gateway 模型目录 */

import {
  MINIMAX_DEFAULT_SPEECH_MODEL_KEY,
  MINIMAX_SPEECH_MODELS,
  MINIMAX_MUSIC_MODELS,
  MINIMAX_DEFAULT_MUSIC_MODEL_KEY,
  MINIMAX_LANGUAGE_BOOST_OPTIONS,
  MINIMAX_VOICE_CLONE_SPEECH_MODELS,
} from "@/lib/gateway/minimax-speech-models";
import {
  readQrAudioPromptTemplates,
  type QrAudioPromptTemplateDef,
} from "@/lib/quick-replica/qr-audio-prompt-templates";

export type { QrAudioPromptTemplateDef };

export type QrAudioModelDef = {
  modelKey: string;
  label: string;
  subtitle: string;
  provider: string;
};

export type QrAudioVoiceDef = {
  voiceId: string;
  label: string;
  subtitle: string;
  gender: "female" | "male" | "neutral";
  accent?: string;
  language?: string;
  previewUrl?: string;
  tags?: string[];
  avatarLetter: string;
};

export type QrAudioStyleTagDef = {
  id: string;
  label: string;
  labelEn?: string;
};

export const QR_AUDIO_MODELS: QrAudioModelDef[] = [
  ...MINIMAX_SPEECH_MODELS.map((m) => ({
    modelKey: m.modelKey,
    label: m.label,
    subtitle: m.subtitle,
    provider: "minimax",
  })),
  ...MINIMAX_MUSIC_MODELS.map((m) => ({
    modelKey: m.modelKey,
    label: m.label,
    subtitle: m.subtitle,
    provider: "minimax",
  })),
];

export const QR_DEFAULT_AUDIO_MODEL_KEY = MINIMAX_DEFAULT_SPEECH_MODEL_KEY;
export const QR_DEFAULT_MUSIC_MODEL_KEY = MINIMAX_DEFAULT_MUSIC_MODEL_KEY;

/** 内联 fallback（完整列表走 GET /quick-replica/voices 分页） */
export const QR_AUDIO_VOICES: QrAudioVoiceDef[] = [
  {
    voiceId: "male-qn-qingse",
    label: "青涩青年音色",
    subtitle: "中文 (普通话)",
    gender: "male",
    language: "中文 (普通话)",
    avatarLetter: "青",
    tags: ["中文", "male"],
  },
  {
    voiceId: "female-shaonv",
    label: "少女音色",
    subtitle: "中文 (普通话)",
    gender: "female",
    language: "中文 (普通话)",
    avatarLetter: "少",
    tags: ["中文", "female"],
  },
  {
    voiceId: "English_expressive_narrator",
    label: "Expressive Narrator",
    subtitle: "English",
    gender: "neutral",
    language: "English",
    avatarLetter: "E",
    tags: ["english"],
  },
];

export const QR_DEFAULT_AUDIO_VOICE_ID = "male-qn-qingse";

export const QR_AUDIO_STYLE_TAGS: QrAudioStyleTagDef[] = [
  { id: "podcast-intro", label: "Podcast Intro", labelEn: "Podcast Intro" },
  { id: "product-explainer", label: "Product Explainer", labelEn: "Product Explainer" },
  { id: "ad-teaser", label: "Ad Teaser", labelEn: "Ad Teaser" },
  { id: "brand-story", label: "Brand Story", labelEn: "Brand Story" },
];

export const QR_DEFAULT_AUDIO_STYLE_TAG = "ad-teaser";

export const QR_AUDIO_VOICE_CONTROL_DEFAULTS = {
  voiceSpeed: 1,
  voiceVolume: 1,
  voicePitch: 0,
  voiceTone: 0.5,
  voiceIntensity: 0.5,
  voiceTimbre: 0.5,
  voiceStability: 0.5,
  voiceSimilarityBoost: 0.75,
  voiceStyleExaggeration: 0,
} as const;

export function getQrAudioModelDef(modelKey: string): QrAudioModelDef {
  return (
    QR_AUDIO_MODELS.find((m) => m.modelKey === modelKey.trim()) ?? QR_AUDIO_MODELS[0]!
  );
}

export function getQrAudioVoiceDef(voiceId: string): QrAudioVoiceDef {
  return (
    QR_AUDIO_VOICES.find((v) => v.voiceId === voiceId.trim()) ?? QR_AUDIO_VOICES[0]!
  );
}

export function getQrAudioCatalog() {
  const promptTemplates = readQrAudioPromptTemplates();
  const voiceoverTemplates = promptTemplates["create-voiceover"];
  const styleTags =
    voiceoverTemplates.length > 0
      ? voiceoverTemplates.map((t) => ({
          id: t.id,
          label: t.name,
          labelEn: t.name,
          content: t.content,
        }))
      : QR_AUDIO_STYLE_TAGS.map((t) => ({ ...t, content: "" }));

  return {
    models: QR_AUDIO_MODELS,
    voiceCloneModels: MINIMAX_VOICE_CLONE_SPEECH_MODELS.map((m) => ({
      modelKey: m.modelKey,
      label: m.label,
      subtitle: m.subtitle,
      provider: "minimax",
    })),
    languageBoostOptions: [...MINIMAX_LANGUAGE_BOOST_OPTIONS],
    voices: QR_AUDIO_VOICES,
    styleTags,
    promptTemplates,
    defaults: {
      modelKey: QR_DEFAULT_AUDIO_MODEL_KEY,
      voiceId: QR_DEFAULT_AUDIO_VOICE_ID,
      styleTag: styleTags[0]?.id ?? QR_DEFAULT_AUDIO_STYLE_TAG,
      languageBoost: "auto",
      ...QR_AUDIO_VOICE_CONTROL_DEFAULTS,
    },
    voicesPaged: true,
  };
}
