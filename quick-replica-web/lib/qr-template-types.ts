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
  source: "builtin" | "user";
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
];

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
      input.kind === "motion-sync" ? "kling-2.6/motion-control" : "lib-nano-pro",
    mode: input.kind === "motion-sync" ? "std" : undefined,
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
  },
  {
    modelKey: "kling-3.0/motion-control",
    label: "Kling 3.0",
    subtitle: "运动模仿",
    defaultMode: "pro" as const,
  },
] as const;

export const MOTION_SYNC_VIDEO_MODES = [
  { value: "std", label: "标准", hint: "720p" },
  { value: "pro", label: "高品质", hint: "1080p" },
] as const;

export const MOTION_SYNC_CHARACTER_ORIENTATIONS = [
  { value: "video", label: "精确的", hint: "跟随参考视频朝向" },
  { value: "image", label: "跟随图片", hint: "跟随角色图朝向" },
] as const;

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
    kind: "add-sound",
    title: "添加音效",
    reference: {
      slots: { referenceAudio: { url: "https://storage.example.com/demo/sfx.mp3" } },
      prompt: { text: "Festive piñata party ambience.", locale: "en" },
      model: { role: "AUDIO", modelKey: "audio-placeholder", params: {} },
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
  const sceneImageUrls =
    t.reference.slots.sceneImages?.map((s) => s.url).filter(Boolean) ?? [];
  return {
    category: t.category,
    kind: t.kind,
    toolKey: t.toolKey,
    title: t.title,
    savedTemplateId: t.source === "user" ? t.id : undefined,
    targetImageUrl: t.reference.slots.targetImage?.url ?? "",
    referenceVideoUrl: t.reference.slots.referenceVideo?.url ?? "",
    referenceAudioUrl: t.reference.slots.referenceAudio?.url ?? "",
    sceneImageUrls,
    prompt: t.reference.prompt.text,
    modelKey: t.reference.model.modelKey,
    mode:
      typeof t.reference.model.params.mode === "string"
        ? t.reference.model.params.mode
        : undefined,
    characterOrientation:
      typeof t.reference.model.params.character_orientation === "string"
        ? t.reference.model.params.character_orientation
        : undefined,
  };
}
