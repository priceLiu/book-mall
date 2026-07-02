export type QrCategory = "video" | "image" | "character" | "world" | "audio";

export type QrTemplateBadge = "new" | "hot" | "pinned";

export type QrMediaRole = "IMAGE" | "VIDEO" | "LLM" | "AUDIO";

export type QrTemplate = {
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
  /** UI 预留：保留参考视频原声（暂未接入 KIE motion-control） */
  keepOriginalSound?: boolean;
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
  outputFormat?: string;
  voiceId?: string;
  audioStyleTag?: string;
  voiceSpeed?: number;
  voiceStability?: number;
  voiceSimilarityBoost?: number;
  voiceStyleExaggeration?: number;
};

export type QrKindDef = {
  id: string;
  label: string;
  labelEn?: string;
  description?: string;
  toolKey?: string;
};

export type QrKindBrowseItem = {
  kind: string;
  label: string;
  labelEn?: string;
  description?: string;
  toolKey?: string;
  featuredTemplate: QrTemplate | null;
};

export const QR_KINDS_BY_CATEGORY: Record<QrCategory, QrKindDef[]> = {
  video: [
    { id: "frame-to-video", label: "帧到视频", labelEn: "Frame to Video" },
    { id: "text-to-video", label: "文字转视频", labelEn: "Text to Video" },
    { id: "smart-shot", label: "智能射击", labelEn: "Smart Shot" },
    { id: "edit-video", label: "编辑视频", labelEn: "Edit Video", toolKey: "edit-video" },
    { id: "replace-background", label: "替换背景", labelEn: "Replace Background" },
    { id: "relight-video", label: "Relight Video", labelEn: "Relight Video" },
    { id: "visual-effects", label: "视觉特效", labelEn: "Visual Effects" },
    {
      id: "motion-sync",
      label: "运动同步",
      labelEn: "Motion Sync",
      toolKey: "motion-sync",
      description: "参考视频动作迁移到目标人物",
    },
    { id: "lip-sync", label: "唇语同步", labelEn: "Lip Sync", toolKey: "lip-sync" },
    { id: "hd-video", label: "高清视频", labelEn: "HD Video" },
    { id: "replace-character", label: "替换字符", labelEn: "Replace Character" },
    { id: "extend-video", label: "扩展视频", labelEn: "Extend Video" },
    { id: "add-sound", label: "添加音效", labelEn: "Add Sound Effects" },
    { id: "reshape-video", label: "重塑视频", labelEn: "Reshape Video" },
  ],
  image: [
    { id: "create-image", label: "创建图像", labelEn: "Create Image" },
    { id: "image-variation", label: "图像变化", labelEn: "Image Variation" },
    { id: "edit-image", label: "编辑图像", labelEn: "Edit Image", toolKey: "edit-image" },
    { id: "expand-image", label: "展开图片", labelEn: "Expand Image" },
    { id: "image-upscale", label: "图像放大", labelEn: "Upscale Image" },
    { id: "multi-view", label: "多视图", labelEn: "Multi-view" },
    { id: "camera-angle", label: "相机角度控制", labelEn: "Camera Angle Control" },
    { id: "face-swap", label: "换脸", labelEn: "Face Swap" },
    { id: "vellum-skin", label: "Vellum 皮肤增强剂", labelEn: "Vellum Skin Enhancer" },
  ],
  character: [
    { id: "create-character", label: "创建角色", labelEn: "Create Character" },
    { id: "browse-library", label: "浏览图书馆", labelEn: "Browse Library" },
    { id: "character-image", label: "角色图像", labelEn: "Character Image" },
    { id: "character-video", label: "角色视频", labelEn: "Character Video" },
    { id: "video-with-sound", label: "有声视频", labelEn: "Video with Sound" },
  ],
  world: [
    { id: "create-world", label: "创造世界", labelEn: "Create World" },
    { id: "world-camera", label: "3D世界摄像头", labelEn: "3D World Camera" },
    { id: "scene-actor", label: "场景演员", labelEn: "Scene Actors" },
  ],
  audio: [
    { id: "create-voiceover", label: "制作旁白", labelEn: "Create Voiceover" },
    { id: "create-music", label: "创作音乐", labelEn: "Create Music" },
    { id: "create-sfx", label: "创建音效", labelEn: "Create Sound Effects" },
    { id: "voice-clone", label: "语音克隆", labelEn: "Voice Cloning" },
    { id: "voice-changer", label: "变声器", labelEn: "Voice Changer" },
  ],
};

export function getKindDef(kindId: string): QrKindDef | null {
  for (const kinds of Object.values(QR_KINDS_BY_CATEGORY)) {
    const hit = kinds.find((k) => k.id === kindId);
    if (hit) return hit;
  }
  return null;
}

/** 右栏有独立 gallery 的子 kind（须预取 template cache，与 book-mall filterTemplatesForGallery 对齐） */
export const QR_KIND_GALLERY_PREFETCH: ReadonlyArray<{
  category: QrCategory;
  kind: string;
}> = [
  { category: "video", kind: "motion-sync" },
  /** 视频顶层 gallery 条目 kind 均为 text-to-video，选中该子类时须单独 cache key */
  { category: "video", kind: "text-to-video" },
  { category: "image", kind: "create-image" },
  { category: "character", kind: "create-character" },
  { category: "audio", kind: "create-voiceover" },
];

export function isQrTextToImageKind(kind: string): boolean {
  return kind === "create-image" || kind === "create-character" || kind === "character-image";
}

export function isQrTextToAudioKind(input: { category: QrCategory; kind: string }): boolean {
  return (
    input.category === "audio" &&
    (input.kind === "create-voiceover" ||
      input.kind === "create-music" ||
      input.kind === "create-sfx" ||
      input.kind === "voice-clone" ||
      input.kind === "voice-changer")
  );
}

export function invalidateQrTemplateCacheForCategory(
  cache: Map<string, QrTemplate[]>,
  category: QrCategory,
  scope = "all",
): void {
  const prefix = `${scope}|${category}`;
  for (const key of cache.keys()) {
    if (key === prefix || key.startsWith(`${prefix}|`)) {
      cache.delete(key);
    }
  }
}

export function qrTemplateCacheKey(
  scope: string,
  category: QrCategory,
  kind?: string | null,
): string {
  const parts = [scope, category];
  if (kind) parts.push(kind);
  return parts.join("|");
}

export function defaultWorkspaceDraft(input: {
  category: QrCategory;
  kind: string;
  toolKey?: string;
}): QrWorkspaceDraft {
  return {
    category: input.category,
    kind: input.kind,
    toolKey: input.toolKey,
    targetImageUrl: "",
    referenceVideoUrl: "",
    referenceAudioUrl: "",
    sceneImageUrls: [],
    prompt: "",
    modelKey:
      input.kind === "motion-sync"
        ? "kling-2.6/motion-control"
        : input.kind === "text-to-video"
          ? TEXT_TO_VIDEO_DEFAULT_MODEL_KEY
          : input.kind === "create-image" || input.kind === "create-character" || input.kind === "character-image"
            ? TEXT_TO_IMAGE_DEFAULT_MODEL_KEY
            : input.category === "audio"
              ? "eleven_multilingual_v2"
              : "lib-nano-pro",
    mode:
      input.kind === "motion-sync"
        ? "std"
        : input.kind === "text-to-video"
          ? "normal"
          : undefined,
    aspectRatio:
      input.kind === "create-image" || isQrTextToImageKind(input.kind) ? "1:1" : undefined,
    resolution:
      input.kind === "create-image" || isQrTextToImageKind(input.kind) ? "2K" : undefined,
    outputFormat:
      input.kind === "create-image" || isQrTextToImageKind(input.kind) ? "png" : undefined,
    voiceId: input.category === "audio" ? "khanh-tu" : undefined,
    audioStyleTag: input.category === "audio" ? "ad-teaser" : undefined,
    voiceSpeed: input.category === "audio" ? 1 : undefined,
    voiceStability: input.category === "audio" ? 0.5 : undefined,
    voiceSimilarityBoost: input.category === "audio" ? 0.75 : undefined,
    voiceStyleExaggeration: input.category === "audio" ? 0 : undefined,
    characterOrientation: input.kind === "motion-sync" ? "video" : undefined,
    keepOriginalSound: input.kind === "motion-sync" ? true : undefined,
  };
}

export const QR_CATEGORIES: {
  id: QrCategory;
  label: string;
  labelEn: string;
}[] = [
  { id: "video", label: "视频", labelEn: "Video" },
  { id: "image", label: "图像", labelEn: "Image" },
  { id: "character", label: "角色", labelEn: "Character" },
  { id: "world", label: "场景", labelEn: "Scene" },
  { id: "audio", label: "声音", labelEn: "Audio" },
];

export const QR_PINNED_TOOLS: {
  toolKey: string;
  label: string;
  category: QrCategory;
  kind: string;
}[] = [
  { toolKey: "motion-sync", label: "运动同步", category: "video", kind: "motion-sync" },
  { toolKey: "lip-sync", label: "唇语同步", category: "video", kind: "lip-sync" },
  { toolKey: "edit-image", label: "编辑图像", category: "image", kind: "edit-image" },
  { toolKey: "edit-video", label: "编辑视频", category: "video", kind: "edit-video" },
];

export const MOTION_SYNC_MODELS = [
  {
    modelKey: "kling-2.6/motion-control",
    label: "Kling 2.6",
    subtitle: "运动模仿",
    defaultMode: "std" as const,
    kind: "motion-control" as const,
  },
  {
    modelKey: "kling-3.0/motion-control",
    label: "Kling 3.0",
    subtitle: "运动模仿",
    defaultMode: "pro" as const,
    kind: "motion-control" as const,
  },
  {
    modelKey: "happyhorse-1-1/reference-to-video",
    label: "HappyHorse 1.1",
    subtitle: "参考图生视频",
    defaultMode: "1080p" as const,
    kind: "reference-to-video" as const,
  },
] as const;

export const HAPPYHORSE_R2V_MODEL_KEY = "happyhorse-1-1/reference-to-video";

export function isHappyHorseR2vModel(modelKey: string): boolean {
  return modelKey.trim() === HAPPYHORSE_R2V_MODEL_KEY;
}

/** HappyHorse 参考图：优先 sceneImageUrls，否则回退 targetImageUrl（模板复制） */
export function resolveMotionSyncReferenceImageUrls(draft: {
  sceneImageUrls: string[];
  targetImageUrl: string;
}): string[] {
  const fromScene = draft.sceneImageUrls.map((u) => u.trim()).filter(Boolean);
  if (fromScene.length) return fromScene;
  const target = draft.targetImageUrl.trim();
  return target ? [target] : [];
}

export const HAPPYHORSE_IMAGE_REF_TOKEN_RE = /\[Image\s+(\d+)\]/gi;

export function parseHappyHorsePromptImageIndices(prompt: string): number[] {
  const indices: number[] = [];
  const re = new RegExp(HAPPYHORSE_IMAGE_REF_TOKEN_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(prompt)) !== null) {
    const n = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(n) && n > 0) indices.push(n);
  }
  return indices;
}

export function maxHappyHorsePromptImageIndex(prompt: string): number {
  const indices = parseHappyHorsePromptImageIndices(prompt);
  return indices.length ? Math.max(...indices) : 0;
}

export function formatHappyHorseImageRefToken(index: number): string {
  return `[Image ${index}]`;
}

export function validateHappyHorseMotionSyncDraft(args: {
  prompt: string;
  sceneImageUrls: string[];
  targetImageUrl: string;
}): string | null {
  const refs = resolveMotionSyncReferenceImageUrls(args);
  if (!refs.length) return "请先上传至少一张参考图";
  const prompt = args.prompt.trim();
  if (!prompt) return "请填写提示词";
  const maxIdx = maxHappyHorsePromptImageIndex(prompt);
  if (maxIdx > refs.length) {
    return `提示词引用了 [Image ${maxIdx}]，但只有 ${refs.length} 张参考图`;
  }
  return null;
}

export const HAPPYHORSE_R2V_MAX_REFS = 9;

export const HAPPYHORSE_R2V_RESOLUTIONS = [
  { value: "720p", label: "720P" },
  { value: "1080p", label: "1080P" },
] as const;

export const HAPPYHORSE_R2V_ASPECT_RATIOS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "1:1", label: "1:1" },
] as const;

export const HAPPYHORSE_R2V_DURATION_MIN = 3;
export const HAPPYHORSE_R2V_DURATION_MAX = 15;

export const MOTION_SYNC_VIDEO_MODES = [
  { value: "std", label: "标准", hint: "720p" },
  { value: "pro", label: "高品质", hint: "1080p" },
] as const;

export const MOTION_SYNC_CHARACTER_ORIENTATIONS = [
  { value: "image", label: "图像", hint: "跟随角色图朝向" },
  { value: "video", label: "视频", hint: "跟随参考视频朝向" },
] as const;

/** 运动同步提示词最大长度（与 KIE motion-control 对齐） */
export const MOTION_SYNC_PROMPT_MAX_LENGTH = 2500;

/** 文字转视频 · 模型清单（与 book-mall qr-text-to-video-models 对齐） */
export const TEXT_TO_VIDEO_MODELS = [
  {
    modelKey: "doubao-seedance-2.0",
    label: "Seedance 2.0",
    subtitle: "火山方舟 · 文/图生视频",
    maxRefImages: 8,
    paramProfile: "seedance20" as const,
    supportsSound: true as const,
  },
  {
    modelKey: "grok-imagine/image-to-video",
    label: "Grok Imagine",
    subtitle: "图/文生视频",
    maxRefImages: 7,
    paramProfile: "grok_i2v" as const,
    defaultMode: "normal" as const,
  },
  {
    modelKey: "kling/v3-turbo-text-to-video",
    label: "Kling 3.0 Turbo",
    subtitle: "文生视频",
    maxRefImages: 0,
    paramProfile: "kling_turbo" as const,
  },
  {
    modelKey: "kling-3.0/video",
    label: "Kling 3.0",
    subtitle: "图/文生视频",
    maxRefImages: 4,
    paramProfile: "kling30" as const,
    defaultMode: "pro" as const,
    supportsSound: true as const,
  },
  {
    modelKey: "happyhorse-1-1/reference-to-video",
    label: "HappyHorse 1.1",
    subtitle: "参考图生视频",
    maxRefImages: 9,
    paramProfile: "happyhorse_r2v" as const,
    usesImageTokens: true as const,
  },
  {
    modelKey: "wan/2-7-text-to-video",
    label: "Wan 2.7",
    subtitle: "文生视频",
    maxRefImages: 0,
    paramProfile: "wan_t2v" as const,
  },
] as const;

export const TEXT_TO_VIDEO_DEFAULT_MODEL_KEY = "grok-imagine/image-to-video";

export type QrTextToVideoParamProfile =
  (typeof TEXT_TO_VIDEO_MODELS)[number]["paramProfile"];

export function getTextToVideoModelDef(modelKey: string) {
  return (
    TEXT_TO_VIDEO_MODELS.find((m) => m.modelKey === modelKey.trim()) ??
    TEXT_TO_VIDEO_MODELS[0]
  );
}

export function resolveTextToVideoReferenceImageUrls(draft: {
  sceneImageUrls: string[];
  targetImageUrl: string;
}): string[] {
  return resolveMotionSyncReferenceImageUrls(draft);
}

/** 文生图 · 模型清单（与 book-mall qr-text-to-image-models 对齐） */
export const TEXT_TO_IMAGE_MODELS = [
  {
    modelKey: "lib-nano-pro",
    label: "Nano Banana Pro",
    subtitle: "高质量文/图生图",
    maxRefImages: 8,
    paramProfile: "nano_pro" as const,
  },
  {
    modelKey: "grok-imagine/text-to-image",
    label: "Grok Imagine",
    subtitle: "文生图",
    maxRefImages: 0,
    paramProfile: "grok_t2i" as const,
  },
  {
    modelKey: "flux-2-pro",
    label: "Flux 2 Pro",
    subtitle: "文/图生图",
    maxRefImages: 4,
    paramProfile: "flux2" as const,
  },
  {
    modelKey: "seedream-5-lite",
    label: "Seedream 5 Lite",
    subtitle: "文/图生图",
    maxRefImages: 4,
    paramProfile: "seedream" as const,
    defaultMode: "basic" as const,
  },
  {
    modelKey: "seedream-4.5",
    label: "Seedream 4.5",
    subtitle: "文/图生图",
    maxRefImages: 4,
    paramProfile: "seedream" as const,
    defaultMode: "basic" as const,
  },
  {
    modelKey: "gpt-image-2",
    label: "GPT Image 2",
    subtitle: "文/图生图",
    maxRefImages: 4,
    paramProfile: "gpt_image_2" as const,
  },
  {
    modelKey: "gpt-image-1",
    label: "GPT Image 1.5",
    subtitle: "文/图生图",
    maxRefImages: 4,
    paramProfile: "gpt_image_1" as const,
    defaultMode: "medium" as const,
  },
  {
    modelKey: "qwen-text-to-image",
    label: "Qwen 文生图",
    subtitle: "文/图生图",
    maxRefImages: 1,
    paramProfile: "qwen_t2i" as const,
  },
] as const;

export const TEXT_TO_IMAGE_DEFAULT_MODEL_KEY = "lib-nano-pro";

export const TEXT_TO_IMAGE_PROMPT_MAX_LENGTH = 4000;

export type QrTextToImageParamProfile =
  (typeof TEXT_TO_IMAGE_MODELS)[number]["paramProfile"];

export function getTextToImageModelDef(modelKey: string) {
  return (
    TEXT_TO_IMAGE_MODELS.find((m) => m.modelKey === modelKey.trim()) ??
    TEXT_TO_IMAGE_MODELS[0]
  );
}

export function resolveTextToImageReferenceImageUrls(draft: {
  sceneImageUrls: string[];
  targetImageUrl: string;
}): string[] {
  return resolveMotionSyncReferenceImageUrls(draft);
}

export function validateTextToImageDraft(args: {
  modelKey: string;
  prompt: string;
  sceneImageUrls: string[];
  targetImageUrl: string;
}): string | null {
  const meta = getTextToImageModelDef(args.modelKey);
  const prompt = args.prompt.trim();
  if (!prompt) return "请填写提示词";
  const refs = resolveTextToImageReferenceImageUrls(args);
  if (meta.maxRefImages === 0 && refs.length > 0) {
    return "当前模型不支持参考图，请移除参考图";
  }
  if (refs.length > meta.maxRefImages) {
    return `参考图最多 ${meta.maxRefImages} 张`;
  }
  return null;
}

export const IMAGE_T2I_ASPECT_RATIOS = [
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
] as const;

export const NANO_PRO_RESOLUTIONS = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
] as const;

export const FLUX2_RESOLUTIONS = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
] as const;

export const GPT_IMAGE_2_RESOLUTIONS = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" },
] as const;

export const SEEDREAM_QUALITIES = [
  { value: "basic", label: "标准" },
  { value: "high", label: "高品质" },
] as const;

export const GPT_IMAGE_1_QUALITIES = [
  { value: "medium", label: "标准" },
  { value: "high", label: "高品质" },
] as const;

export const QWEN_OUTPUT_FORMATS = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
] as const;

export const NANO_PRO_OUTPUT_FORMATS = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" },
] as const;

export function validateTextToVideoDraft(args: {
  modelKey: string;
  prompt: string;
  sceneImageUrls: string[];
  targetImageUrl: string;
}): string | null {
  const meta = getTextToVideoModelDef(args.modelKey);
  const prompt = args.prompt.trim();
  if (!prompt) return "请填写提示词";

  const refs = resolveTextToVideoReferenceImageUrls(args);

  if ("usesImageTokens" in meta && meta.usesImageTokens) {
    if (!refs.length) return "请先上传至少一张参考图";
    const maxIdx = maxHappyHorsePromptImageIndex(prompt);
    if (maxIdx > refs.length) {
      return `提示词引用了 [Image ${maxIdx}]，但只有 ${refs.length} 张参考图`;
    }
  }

  return null;
}

export const GROK_I2V_MODES = [
  { value: "normal", label: "标准" },
  { value: "fun", label: "趣味" },
  { value: "spicy", label: "Spicy" },
] as const;

export const GROK_I2V_ASPECT_RATIOS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "auto", label: "自动" },
] as const;

export const GROK_I2V_RESOLUTIONS = [
  { value: "480p", label: "480P" },
  { value: "720p", label: "720P" },
] as const;

export const KLING_TURBO_RESOLUTIONS = [
  { value: "720p", label: "720P" },
  { value: "1080p", label: "1080P" },
] as const;

export const KLING_TURBO_ASPECT_RATIOS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
] as const;

export const WAN_T2V_ASPECT_RATIOS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
] as const;

export const WAN_T2V_RESOLUTIONS = [
  { value: "720p", label: "720P" },
  { value: "1080p", label: "1080P" },
] as const;

export const WAN_T2V_DURATION_MIN = 5;
export const WAN_T2V_DURATION_MAX = 10;

export const SEEDANCE20_RESOLUTIONS = [
  { value: "720p", label: "720P" },
  { value: "1080p", label: "1080P" },
] as const;

export const SEEDANCE20_ASPECT_RATIOS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "adaptive", label: "自适应" },
] as const;

export const SEEDANCE20_DURATION_MIN = 4;
export const SEEDANCE20_DURATION_MAX = 15;

export function textToVideoModelSupportsSound(modelKey: string): boolean {
  const meta = getTextToVideoModelDef(modelKey);
  return "supportsSound" in meta && meta.supportsSound === true;
}

export const GROK_I2V_DURATION_MIN = 6;
export const GROK_I2V_DURATION_MAX = 30;

export const KLING30_ASPECT_RATIOS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
] as const;

/** 文字转视频提示词最大长度 */
export const TEXT_TO_VIDEO_PROMPT_MAX_LENGTH = 2500;

function thumb(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/480/360`;
}

function baseTemplate(
  partial: Omit<
    QrTemplate,
    "schemaVersion" | "source" | "visibility" | "sortOrder" | "createdAt" | "updatedAt" | "thumbnailUrl"
  > &
    Partial<Pick<QrTemplate, "sortOrder" | "thumbnailUrl">>,
): QrTemplate {
  const now = "2026-06-20T00:00:00.000Z";
  return {
    schemaVersion: 1,
    source: "builtin",
    visibility: "public",
    sortOrder: partial.sortOrder ?? 100,
    createdAt: now,
    updatedAt: now,
    ...partial,
    thumbnailUrl: partial.thumbnailUrl || thumb(partial.id),
  };
}

/** 内置种子模板（P1 只读；与 content/templates/*.json 同步） */
export const BUILTIN_TEMPLATES: QrTemplate[] = [
  baseTemplate({
    id: "builtin-video-frame-to-video",
    category: "video",
    kind: "frame-to-video",
    title: "帧到视频",
    reference: {
      slots: {},
      prompt: { text: "A cute rabbit turns its head slowly in a greenhouse.", locale: "en" },
      model: { role: "VIDEO", modelKey: "wan/2-6-video-to-video", params: { duration: 5 } },
    },
  }),
  baseTemplate({
    id: "builtin-video-text-to-video",
    category: "video",
    kind: "text-to-video",
    title: "文字转视频",
    badges: ["new"],
    reference: {
      slots: {},
      prompt: { text: "Y2K fashion girl filming with a camcorder on city street.", locale: "en" },
      model: { role: "VIDEO", modelKey: "grok-imagine/image-to-video", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-video-smart-shot",
    category: "video",
    kind: "smart-shot",
    title: "智能射击",
    reference: {
      slots: {},
      prompt: { text: "Cowboy in desert, cinematic wide shot, dust in the air.", locale: "en" },
      model: { role: "VIDEO", modelKey: "wan/2-6-video-to-video", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-video-motion-sync",
    category: "video",
    kind: "motion-sync",
    toolKey: "motion-sync",
    title: "运动同步",
    badges: ["pinned", "hot"],
    reference: {
      slots: {
        targetImage: { url: thumb("motion-target") },
        referenceVideo: { url: "https://storage.example.com/demo/dance-ref.mp4" },
      },
      prompt: {
        text: "Outdoor tennis court, sunny day, natural camera movement.",
        locale: "en",
      },
      model: {
        role: "VIDEO",
        modelKey: "kling-2.6/motion-control",
        params: { mode: "std", character_orientation: "video" },
      },
    },
  }),
  baseTemplate({
    id: "builtin-video-lip-sync",
    category: "video",
    kind: "lip-sync",
    toolKey: "lip-sync",
    title: "唇语同步",
    badges: ["pinned"],
    reference: {
      slots: {
        targetImage: { url: thumb("lip-target") },
        referenceAudio: { url: "https://storage.example.com/demo/voice.mp3" },
      },
      prompt: { text: "Man with boombox, urban background.", locale: "en" },
      model: { role: "VIDEO", modelKey: "kling-2.6/motion-control", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-video-visual-effects",
    category: "video",
    kind: "visual-effects",
    title: "视觉特效",
    reference: {
      slots: {},
      prompt: { text: "Astronaut walking through neon corridor.", locale: "en" },
      model: { role: "VIDEO", modelKey: "wan/2-6-video-to-video", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-image-create",
    category: "image",
    kind: "create-image",
    title: "创建图像",
    reference: {
      slots: { characterRefs: [{ handle: "@fluffy", url: thumb("dog") }] },
      prompt: { text: "@fluffy in glasses, studio lighting.", locale: "en" },
      model: { role: "IMAGE", modelKey: "lib-nano-pro", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-image-variation",
    category: "image",
    kind: "image-variation",
    title: "图像变化",
    reference: {
      slots: { targetImage: { url: thumb("variation") } },
      prompt: { text: "Same person, autumn park background.", locale: "en" },
      model: { role: "IMAGE", modelKey: "lib-nano-pro", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-image-edit",
    category: "image",
    kind: "edit-image",
    toolKey: "edit-image",
    title: "编辑图像",
    badges: ["pinned"],
    reference: {
      slots: { targetImage: { url: thumb("edit") } },
      prompt: { text: "add a gum bubble", locale: "en" },
      model: { role: "IMAGE", modelKey: "lib-nano-pro", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-image-upscale",
    category: "image",
    kind: "image-upscale",
    title: "图像放大",
    reference: {
      slots: { targetImage: { url: thumb("upscale") } },
      prompt: { text: "Enhance detail, preserve colors.", locale: "en" },
      model: { role: "IMAGE", modelKey: "topaz/image-upscale", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-character-create",
    category: "character",
    kind: "create-character",
    title: "创建角色",
    badges: ["new"],
    reference: {
      slots: {},
      prompt: { text: "Portrait of a woman in sun hat, soft light.", locale: "en" },
      model: { role: "IMAGE", modelKey: "lib-nano-pro", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-character-video",
    category: "character",
    kind: "character-video",
    title: "角色视频",
    reference: {
      slots: { characterRefs: [{ handle: "@ire", url: thumb("ire") }] },
      prompt: { text: "@ire in Y2K outfit, camcorder selfie.", locale: "en" },
      model: { role: "VIDEO", modelKey: "grok-imagine/image-to-video", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-character-motion",
    category: "character",
    kind: "motion-sync",
    toolKey: "motion-sync",
    title: "运动同步",
    badges: ["pinned"],
    reference: {
      slots: {
        targetImage: { url: thumb("char-motion") },
        referenceVideo: { url: "https://storage.example.com/demo/dance-ref.mp4" },
      },
      prompt: { text: "Character performs dance moves on stage.", locale: "en" },
      model: { role: "VIDEO", modelKey: "kling-2.6/motion-control", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-world-create",
    category: "world",
    kind: "create-world",
    title: "创造世界",
    reference: {
      slots: { sceneImages: [{ url: thumb("world-desert"), label: "主场景" }] },
      prompt: { text: "Futuristic desert city at golden hour.", locale: "en" },
      model: { role: "IMAGE", modelKey: "lib-nano-pro", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-world-camera",
    category: "world",
    kind: "world-camera",
    title: "3D世界摄像头",
    reference: {
      slots: { sceneImages: [{ url: thumb("world-sea"), label: "海岸" }] },
      prompt: { text: "Mediterranean white building by the sea.", locale: "en" },
      model: { role: "VIDEO", modelKey: "wan/2-6-video-to-video", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-world-scene",
    category: "world",
    kind: "scene-actor",
    title: "场景演员",
    reference: {
      slots: { sceneImages: [{ url: thumb("world-room"), label: "房间" }] },
      prompt: { text: "Musician in a poster-filled room.", locale: "en" },
      model: { role: "IMAGE", modelKey: "lib-nano-pro", params: {} },
    },
  }),
  baseTemplate({
    id: "builtin-audio-placeholder",
    category: "audio",
    kind: "create-voiceover",
    title: "制作旁白",
    reference: {
      slots: {},
      prompt: {
        text: "The new Lynq X3 is built for people who move fast. Meet the phone that keeps up with your day.",
        locale: "en",
      },
      model: {
        role: "AUDIO",
        modelKey: "eleven_multilingual_v2",
        params: {
          voice_id: "khanh-tu",
          style_tag: "ad-teaser",
          speed: 1,
          stability: 0.5,
          similarity_boost: 0.75,
          style_exaggeration: 0,
        },
      },
    },
  }),
];

export function filterTemplates(
  templates: QrTemplate[],
  filters: { category?: QrCategory | null; kind?: string | null; toolKey?: string | null },
): QrTemplate[] {
  return templates.filter((t) => {
    if (filters.category && t.category !== filters.category) return false;
    if (filters.kind && t.kind !== filters.kind) return false;
    if (filters.toolKey && t.toolKey !== filters.toolKey) return false;
    return true;
  });
}

export function templateToWorkspaceDraft(t: QrTemplate): QrWorkspaceDraft {
  const targetImageUrl = t.reference.slots.targetImage?.url ?? "";
  const sceneFromSlots =
    t.reference.slots.sceneImages?.map((s) => s.url).filter(Boolean) ?? [];
  const sceneFromCharacterRefs =
    t.reference.slots.characterRefs?.map((s) => s.url).filter(Boolean) ?? [];
  const sceneImageUrls = sceneFromSlots.length ? sceneFromSlots : sceneFromCharacterRefs;
  return {
    category: t.category,
    kind: t.kind,
    toolKey: t.toolKey,
    title: t.title,
    savedTemplateId: t.source === "user" ? t.id : undefined,
    targetImageUrl,
    referenceVideoUrl: t.reference.slots.referenceVideo?.url ?? "",
    referenceAudioUrl: t.reference.slots.referenceAudio?.url ?? "",
    sceneImageUrls,
    prompt: t.reference.prompt.text,
    modelKey: t.reference.model.modelKey,
    mode:
      typeof t.reference.model.params.mode === "string"
        ? t.reference.model.params.mode
        : typeof t.reference.model.params.quality === "string"
          ? String(t.reference.model.params.quality)
          : undefined,
    aspectRatio:
      typeof t.reference.model.params.aspect_ratio === "string"
        ? t.reference.model.params.aspect_ratio
        : undefined,
    resolution:
      typeof t.reference.model.params.resolution === "string"
        ? t.reference.model.params.resolution
        : undefined,
    outputFormat:
      typeof t.reference.model.params.output_format === "string"
        ? t.reference.model.params.output_format
        : undefined,
    voiceId:
      typeof t.reference.model.params.voice_id === "string"
        ? t.reference.model.params.voice_id
        : undefined,
    audioStyleTag:
      typeof t.reference.model.params.style_tag === "string"
        ? t.reference.model.params.style_tag
        : undefined,
    voiceSpeed:
      typeof t.reference.model.params.speed === "number"
        ? t.reference.model.params.speed
        : undefined,
    voiceStability:
      typeof t.reference.model.params.stability === "number"
        ? t.reference.model.params.stability
        : undefined,
    voiceSimilarityBoost:
      typeof t.reference.model.params.similarity_boost === "number"
        ? t.reference.model.params.similarity_boost
        : undefined,
    voiceStyleExaggeration:
      typeof t.reference.model.params.style_exaggeration === "number"
        ? t.reference.model.params.style_exaggeration
        : undefined,
    characterOrientation:
      typeof t.reference.model.params.character_orientation === "string"
        ? t.reference.model.params.character_orientation
        : undefined,
  };
}
