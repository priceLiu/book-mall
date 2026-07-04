/** QuickReplica 声音 · Gateway 模型目录（MiniMax + ElevenLabs） */

import {
  ELEVENLABS_DEFAULT_MUSIC_MODEL_KEY,
  ELEVENLABS_DEFAULT_SFX_MODEL_KEY,
  ELEVENLABS_DEFAULT_STS_MODEL_KEY,
  ELEVENLABS_DEFAULT_VOICE_ID,
  ELEVENLABS_MUSIC_MODELS,
  ELEVENLABS_SFX_MODELS,
  ELEVENLABS_STS_MODELS,
} from "@/lib/gateway/elevenlabs-models";
import {
  MINIMAX_DEFAULT_SPEECH_MODEL_KEY,
  MINIMAX_MUSIC_MODELS,
  MINIMAX_SPEECH_MODELS,
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
  content?: string;
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
  ...ELEVENLABS_STS_MODELS.map((m) => ({
    modelKey: m.modelKey,
    label: m.label,
    subtitle: m.subtitle,
    provider: "elevenlabs",
  })),
  ...ELEVENLABS_SFX_MODELS.map((m) => ({
    modelKey: m.modelKey,
    label: m.label,
    subtitle: m.subtitle,
    provider: "elevenlabs",
  })),
  ...ELEVENLABS_MUSIC_MODELS.map((m) => ({
    modelKey: m.modelKey,
    label: m.label,
    subtitle: m.subtitle,
    provider: "elevenlabs",
  })),
];

export const QR_VOICE_CHANGER_MODELS: QrAudioModelDef[] = ELEVENLABS_STS_MODELS.map((m) => ({
  modelKey: m.modelKey,
  label: m.label,
  subtitle: m.subtitle,
  provider: "elevenlabs",
}));

export const QR_SFX_MODELS: QrAudioModelDef[] = ELEVENLABS_SFX_MODELS.map((m) => ({
  modelKey: m.modelKey,
  label: m.label,
  subtitle: m.subtitle,
  provider: "elevenlabs",
}));

export const QR_DEFAULT_AUDIO_MODEL_KEY = MINIMAX_DEFAULT_SPEECH_MODEL_KEY;
export const QR_DEFAULT_VOICE_CHANGER_MODEL_KEY = ELEVENLABS_DEFAULT_STS_MODEL_KEY;
export const QR_DEFAULT_SFX_MODEL_KEY = ELEVENLABS_DEFAULT_SFX_MODEL_KEY;
export const QR_DEFAULT_MUSIC_MODEL_KEY = ELEVENLABS_DEFAULT_MUSIC_MODEL_KEY;

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
    voiceId: ELEVENLABS_DEFAULT_VOICE_ID,
    label: "George",
    subtitle: "English · ElevenLabs",
    gender: "male",
    language: "English",
    avatarLetter: "G",
    tags: ["english", "elevenlabs"],
  },
];

export const QR_DEFAULT_AUDIO_VOICE_ID = "male-qn-qingse";
export const QR_DEFAULT_ELEVEN_VOICE_ID = ELEVENLABS_DEFAULT_VOICE_ID;

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

export const QR_SFX_CONTROL_DEFAULTS = {
  sfxLoop: false,
  sfxDurationAuto: true,
  sfxDurationSeconds: 5,
  sfxPromptInfluence: 0.3,
} as const;

export const QR_MUSIC_CONTROL_DEFAULTS = {
  musicClipMode: "quick" as const,
  musicInstrumental: false,
  musicDurationAuto: true,
  musicDurationSeconds: 180,
  musicBpmAuto: true,
  musicBpm: 120,
  musicIntensityAuto: true,
  musicIntensity: "medium",
  musicKeyAuto: true,
  musicKey: "C major",
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
  const sfxTemplates = promptTemplates["create-sfx"];
  const musicTemplates = promptTemplates["create-music"];

  const styleTags =
    voiceoverTemplates.length > 0
      ? voiceoverTemplates.map((t) => ({
          id: t.id,
          label: t.name,
          labelEn: t.name,
          content: t.content,
        }))
      : QR_AUDIO_STYLE_TAGS.map((t) => ({ ...t, content: "" }));

  const sfxStyleTags =
    sfxTemplates.length > 0
      ? sfxTemplates.map((t) => ({
          id: t.id,
          label: t.name,
          labelEn: t.name,
          content: t.content,
        }))
      : [];

  const musicStyleTags =
    musicTemplates.length > 0
      ? musicTemplates.map((t) => ({
          id: t.id,
          label: t.name,
          labelEn: t.name,
          content: t.content,
        }))
      : [];

  return {
    models: QR_AUDIO_MODELS,
    voiceChangerModels: QR_VOICE_CHANGER_MODELS,
    sfxModels: QR_SFX_MODELS,
    voiceCloneModels: MINIMAX_VOICE_CLONE_SPEECH_MODELS.map((m) => ({
      modelKey: m.modelKey,
      label: m.label,
      subtitle: m.subtitle,
      provider: "minimax",
    })),
    languageBoostOptions: [...MINIMAX_LANGUAGE_BOOST_OPTIONS],
    voices: QR_AUDIO_VOICES,
    styleTags,
    sfxStyleTags,
    musicStyleTags,
    promptTemplates,
    defaults: {
      modelKey: QR_DEFAULT_AUDIO_MODEL_KEY,
      voiceChangerModelKey: QR_DEFAULT_VOICE_CHANGER_MODEL_KEY,
      sfxModelKey: QR_DEFAULT_SFX_MODEL_KEY,
      musicModelKey: QR_DEFAULT_MUSIC_MODEL_KEY,
      voiceId: QR_DEFAULT_AUDIO_VOICE_ID,
      elevenVoiceId: QR_DEFAULT_ELEVEN_VOICE_ID,
      styleTag: styleTags[0]?.id ?? QR_DEFAULT_AUDIO_STYLE_TAG,
      languageBoost: "auto",
      ...QR_AUDIO_VOICE_CONTROL_DEFAULTS,
      ...QR_SFX_CONTROL_DEFAULTS,
      ...QR_MUSIC_CONTROL_DEFAULTS,
    },
    voicesPaged: true,
    elevenVoicesLive: true,
  };
}
