/** QuickReplica 声音 · 模拟目录（前台 / 管理后台共用） */

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
  tags?: string[];
  /** 列表卡片首字母 / 渐变色标识 */
  avatarLetter: string;
};

export type QrAudioStyleTagDef = {
  id: string;
  label: string;
  labelEn?: string;
};

export const QR_AUDIO_MODELS: QrAudioModelDef[] = [
  {
    modelKey: "eleven_multilingual_v2",
    label: "Eleven Multilingual v2",
    subtitle: "多语言旁白 · 高自然度",
    provider: "elevenlabs",
  },
  {
    modelKey: "eleven_turbo_v2_5",
    label: "Eleven Turbo v2.5",
    subtitle: "低延迟 · 适合预览",
    provider: "elevenlabs",
  },
  {
    modelKey: "minimax_speech_02",
    label: "MiniMax Speech 02",
    subtitle: "中文旁白 · 情感丰富",
    provider: "minimax",
  },
];

export const QR_DEFAULT_AUDIO_MODEL_KEY = "eleven_multilingual_v2";

export const QR_AUDIO_VOICES: QrAudioVoiceDef[] = [
  {
    voiceId: "khanh-tu",
    label: "Khánh Tư",
    subtitle: "Giọng kể chuyện và nhân vật",
    gender: "female",
    accent: "southern",
    tags: ["characters_animation", "female", "southern"],
    avatarLetter: "K",
  },
  {
    voiceId: "mei-ling",
    label: "Mei Ling",
    subtitle: "温暖女声 · 品牌故事",
    gender: "female",
    accent: "mandarin",
    tags: ["narration", "female", "mandarin"],
    avatarLetter: "M",
  },
  {
    voiceId: "alex-chen",
    label: "Alex Chen",
    subtitle: "清晰男声 · 产品解说",
    gender: "male",
    accent: "neutral",
    tags: ["product", "male"],
    avatarLetter: "A",
  },
  {
    voiceId: "sarah-uk",
    label: "Sarah",
    subtitle: "英式英语 · 播客片头",
    gender: "female",
    accent: "british",
    tags: ["podcast", "female", "english"],
    avatarLetter: "S",
  },
];

export const QR_DEFAULT_AUDIO_VOICE_ID = "khanh-tu";

export const QR_AUDIO_STYLE_TAGS: QrAudioStyleTagDef[] = [
  { id: "podcast-intro", label: "Podcast Intro", labelEn: "Podcast Intro" },
  { id: "product-explainer", label: "Product Explainer", labelEn: "Product Explainer" },
  { id: "ad-teaser", label: "Ad Teaser", labelEn: "Ad Teaser" },
  { id: "brand-story", label: "Brand Story", labelEn: "Brand Story" },
];

export const QR_DEFAULT_AUDIO_STYLE_TAG = "ad-teaser";

export const QR_AUDIO_VOICE_CONTROL_DEFAULTS = {
  voiceSpeed: 1,
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
  return {
    models: QR_AUDIO_MODELS,
    voices: QR_AUDIO_VOICES,
    styleTags: QR_AUDIO_STYLE_TAGS,
    defaults: {
      modelKey: QR_DEFAULT_AUDIO_MODEL_KEY,
      voiceId: QR_DEFAULT_AUDIO_VOICE_ID,
      styleTag: QR_DEFAULT_AUDIO_STYLE_TAG,
      ...QR_AUDIO_VOICE_CONTROL_DEFAULTS,
    },
  };
}
