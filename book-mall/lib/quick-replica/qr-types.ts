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
  /** 变声器源音频 URL */
  sourceAudioUrl?: string;
  /** 音乐生成模式 */
  musicMode?: "generate" | "cover" | "lyrics";
};
