/**
 * 分镜 / 电商工具箱 · 视频模型能力类型（卡片角标：文生视频 / 图生视频 …）
 * 与 canvas-web `story-model-capabilities.ts` / book-mall 登记对齐。
 */

export type StoryboardVideoModelCapability =
  | "video_t2v"
  | "video_i2v"
  | "video_r2v"
  | "video_v2v"
  | "video_multi_ref";

const VIDEO_CAPABILITY_LABELS: Record<StoryboardVideoModelCapability, string> = {
  video_t2v: "文生视频",
  video_i2v: "图生视频",
  video_r2v: "参考生视频",
  video_v2v: "视频生视频",
  video_multi_ref: "多参考图",
};

const VIDEO_CAPABILITY_ORDER: StoryboardVideoModelCapability[] = [
  "video_t2v",
  "video_i2v",
  "video_r2v",
  "video_v2v",
  "video_multi_ref",
];

const EXPLICIT: Record<string, StoryboardVideoModelCapability[]> = {
  "grok-imagine/image-to-video": ["video_i2v"],
  "grok-imagine-video-1-5-preview": ["video_i2v"],
  "wan/2-6-video-to-video": ["video_v2v"],
  "kling-2.6/image-to-video": ["video_i2v"],
  "kling/v3-turbo-image-to-video": ["video_i2v"],
  "kling/v3-turbo-text-to-video": ["video_t2v"],
  "kling-3.0/video": ["video_i2v", "video_t2v"],
  "bytedance/seedance-2": ["video_i2v", "video_r2v", "video_multi_ref"],
  "doubao-seedance-2.0": ["video_i2v", "video_r2v", "video_multi_ref"],
  "doubao-seedance-1.5-pro": ["video_i2v"],
  "wan/2-7-image-to-video": ["video_i2v"],
  "happyhorse/image-to-video": ["video_i2v"],
  "happyhorse-1.0-t2v": ["video_t2v"],
  "happyhorse-1.0-i2v": ["video_i2v"],
  "happyhorse-1.0-r2v": ["video_r2v", "video_multi_ref"],
  "happyhorse-1.1-t2v": ["video_t2v"],
  "happyhorse-1.1-i2v": ["video_i2v"],
  "happyhorse-1.1-r2v": ["video_r2v", "video_multi_ref"],
  "wan2.6-r2v": ["video_r2v", "video_multi_ref"],
  "wan2.6-r2v-flash": ["video_r2v", "video_multi_ref"],
  "wan2.7-r2v": ["video_r2v", "video_multi_ref"],
  "wan2.6-t2v": ["video_t2v"],
  "wan2.7-t2v": ["video_t2v"],
  "wan2.7-t2v-2026-04-25": ["video_t2v"],
  "wan3.0-video": ["video_t2v"],
};

/** 视频模型能力推断（筛选 · 角标共用） */
export function inferStoryboardVideoCapabilities(
  modelKey: string,
): StoryboardVideoModelCapability[] {
  return inferVideoCapabilities(modelKey);
}

function inferVideoCapabilities(modelKey: string): StoryboardVideoModelCapability[] {
  const k = modelKey.trim().toLowerCase();
  if (!k) return [];

  const explicit = EXPLICIT[k] ?? EXPLICIT[modelKey.trim()];
  if (explicit) return [...explicit];

  const caps: StoryboardVideoModelCapability[] = [];

  if (k.includes("-r2v") || k.endsWith("r2v")) {
    caps.push("video_r2v");
  }
  if (
    k.includes("image-to-video") ||
    k.includes("i2v") ||
    k.includes("it2v") ||
    k.includes("/i2v")
  ) {
    caps.push("video_i2v");
  }
  if (
    k.includes("text-to-video") ||
    k.includes("t2v") ||
    k.includes("/t2v") ||
    (k.includes("video") && !caps.includes("video_i2v") && !caps.includes("video_r2v"))
  ) {
    caps.push("video_t2v");
  }
  if (k.includes("video-to-video") || k.includes("v2v")) {
    caps.push("video_v2v");
  }
  if (!caps.length) caps.push("video_i2v");
  return caps;
}

/** 视频模型卡片 · 能力类型文案（有序、去重） */
export function getStoryboardVideoModelTypeLabels(modelKey: string): string[] {
  const caps = new Set(inferVideoCapabilities(modelKey));
  return VIDEO_CAPABILITY_ORDER.filter((c) => caps.has(c)).map(
    (c) => VIDEO_CAPABILITY_LABELS[c],
  );
}

/** 卡片角标：单一主类型；多能力时用「 · 」连接 */
export function formatStoryboardVideoModelTypeLabel(modelKey: string): string {
  const labels = getStoryboardVideoModelTypeLabels(modelKey);
  return labels.length ? labels.join(" · ") : "视频";
}
