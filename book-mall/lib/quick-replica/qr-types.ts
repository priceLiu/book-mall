export type QrCategory = "video" | "image" | "character" | "world" | "audio";

export type QrTemplateBadge = "new" | "hot" | "pinned";

export type QrMediaRole = "IMAGE" | "VIDEO" | "LLM" | "AUDIO";

export type QrTemplateJson = {
  schemaVersion: 1;
  id: string;
  category: QrCategory;
  kind: string;
  toolKey?: string;
  title: string;
  thumbnailUrl: string;
  badges?: QrTemplateBadge[];
  source: "builtin" | "user" | "catalog";
  ownerUserId?: string;
  visibility: "private" | "public";
  reference: {
    slots: {
      targetImage?: { url: string; ossKey?: string };
      referenceVideo?: { url: string; ossKey?: string };
      referenceAudio?: { url: string; ossKey?: string };
      sceneImages?: Array<{ url: string; label?: string }>;
      characterRefs?: Array<{ handle?: string; url: string }>;
    };
    prompt: { text: string; negative?: string; locale?: "zh" | "en" };
    model: {
      role: QrMediaRole;
      providerId?: string;
      modelKey: string;
      params: Record<string, unknown>;
    };
  };
  output?: {
    mediaType: "image" | "video" | "audio";
    url: string;
    gatewayRequestLogId?: string;
    createdAt: string;
  };
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type QrTemplateListFilters = {
  category?: QrCategory | null;
  kind?: string | null;
  toolKey?: string | null;
  scope?: "all" | "my";
};

export type QrKindBrowseItem = {
  kind: string;
  label: string;
  labelEn?: string;
  description?: string;
  toolKey?: string;
  featuredTemplate: QrTemplateJson | null;
};

export type QrWorkspaceDraft = {
  category: QrCategory;
  kind: string;
  toolKey?: string;
  title?: string;
  /** 复制或新建后自动保存的用户模板 id，用于后续编辑同步 */
  savedTemplateId?: string;
  targetImageUrl: string;
  referenceVideoUrl: string;
  referenceAudioUrl: string;
  sceneImageUrls: string[];
  prompt: string;
  modelKey: string;
  mode?: string;
  characterOrientation?: string;
  keepOriginalSound?: boolean;
  /** HappyHorse R2V：720p | 1080p */
  resolution?: string;
  /** HappyHorse R2V：16:9 等 */
  aspectRatio?: string;
  /** HappyHorse R2V：3–15 秒 */
  duration?: number;
  /** 文生图：png | jpeg | webp */
  outputFormat?: string;
  /** 旁白音色 id（audio catalog） */
  voiceId?: string;
  /** 旁白风格标签 id */
  audioStyleTag?: string;
  voiceSpeed?: number;
  voiceVolume?: number;
  voicePitch?: number;
  voiceTone?: number;
  voiceIntensity?: number;
  voiceTimbre?: number;
  voiceStability?: number;
  voiceSimilarityBoost?: number;
  voiceStyleExaggeration?: number;
  /** 音效 · 无缝循环（Eleven Sound Effects v2） */
  sfxLoop?: boolean;
  /** 音效 · 自动时长（否则用 sfxDurationSeconds） */
  sfxDurationAuto?: boolean;
  /** 音效 · 固定时长 0.5–30s */
  sfxDurationSeconds?: number;
  /** 音效 · Prompt Influence 0–1 */
  sfxPromptInfluence?: number;
  /** 变声器源音频 URL */
  sourceAudioUrl?: string;
  /** 音色快速复刻 · 自定义 voice_id（留空则自动生成） */
  cloneVoiceId?: string;
  /** 音色快速复刻 · language_boost，默认 auto */
  languageBoost?: string;
  /** 参考音频 ASR 校验文本 */
  textValidation?: string;
  /** ASR 相似度阈值 0–1 */
  accuracy?: number;
  needNoiseReduction?: boolean;
  needVolumeNormalization?: boolean;
  aigcWatermark?: boolean;
  /** 可选示例音频 URL + 文本（clone_prompt） */
  clonePromptAudioUrl?: string;
  clonePromptText?: string;
  /** 情感权重（UI 八维，总和 ≤ 1.5） */
  voiceEmotions?: Record<string, number>;
  /** 创作音乐 · Quick Clip / Full Song */
  musicClipMode?: "quick" | "full";
  musicInstrumental?: boolean;
  musicDurationAuto?: boolean;
  musicDurationSeconds?: number;
  musicBpmAuto?: boolean;
  musicBpm?: number;
  musicIntensityAuto?: boolean;
  musicIntensity?: string;
  musicKeyAuto?: boolean;
  musicKey?: string;
  /** @deprecated 旧 MiniMax 音乐模式 */
  musicMode?: "generate" | "cover" | "lyrics";
  /** Marble 世界：参考图方位角（与 sceneImageUrls 对齐） */
  worldRefAzimuths?: number[];
  /** Marble 多图：Auto Layout / reconstruct_images */
  worldAutoLayout?: boolean;
  /** Marble 单图：全景检测 auto | true | false */
  worldIsPano?: boolean | "auto";
};
