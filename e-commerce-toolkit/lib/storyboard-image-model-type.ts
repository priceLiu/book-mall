/**
 * 电商工具箱 · 生图模型能力（卡片角标：文生图 / 图片编辑 …）
 * 与 book-mall `ecom-storyboard-image-edit` / story-model-capabilities 对齐。
 */

export type StoryboardImageModelCapability =
  | "image_t2i"
  | "image_edit"
  | "image_multi_ref";

const IMAGE_CAPABILITY_LABELS: Record<StoryboardImageModelCapability, string> = {
  image_t2i: "文生图",
  image_edit: "图片编辑",
  image_multi_ref: "多图参考",
};

const IMAGE_CAPABILITY_ORDER: StoryboardImageModelCapability[] = [
  "image_t2i",
  "image_edit",
  "image_multi_ref",
];

const EXPLICIT: Record<string, StoryboardImageModelCapability[]> = {
  "qwen-image-edit": ["image_edit", "image_multi_ref"],
  "qwen-image-edit-max": ["image_edit", "image_multi_ref"],
  "qwen-image-3.0-pro": ["image_t2i", "image_edit", "image_multi_ref"],
  "wan2.7-image-pro": ["image_t2i", "image_edit", "image_multi_ref"],
  "wan2.7-image": ["image_t2i", "image_multi_ref"],
  "wan2.6-image": ["image_t2i", "image_edit", "image_multi_ref"],
  "z-image-turbo": ["image_t2i"],
  "kling-3.0-image": ["image_t2i", "image_multi_ref"],
  "nano-banana-pro": ["image_t2i", "image_multi_ref"],
};

function inferImageCapabilities(modelKey: string): StoryboardImageModelCapability[] {
  const k = modelKey.trim().toLowerCase();
  if (!k) return [];

  const explicit = EXPLICIT[k] ?? EXPLICIT[modelKey.trim()];
  if (explicit) return [...explicit];

  const caps: StoryboardImageModelCapability[] = [];

  if (
    k.includes("image-edit") ||
    k.includes("/edit") ||
    k.includes("i2i") ||
    k.includes("img2img")
  ) {
    caps.push("image_edit");
  }
  if (
    k.includes("wan2.7-image") ||
    k.includes("wan2.6-image") ||
    k.includes("kling") ||
    k.includes("nano-banana") ||
    k.includes("seedream")
  ) {
    caps.push("image_multi_ref");
  }
  if (
    k.includes("t2i") ||
    k.includes("text-to-image") ||
    k.includes("wan") && k.includes("image") ||
    k.includes("qwen-image") ||
    k.includes("seedream")
  ) {
    caps.push("image_t2i");
  }

  if (!caps.length && modelKey.trim()) caps.push("image_t2i");
  return [...new Set(caps)];
}

export function inferStoryboardImageCapabilities(
  modelKey: string,
): StoryboardImageModelCapability[] {
  return inferImageCapabilities(modelKey);
}

export function getStoryboardImageModelTypeLabels(modelKey: string): string[] {
  const caps = new Set(inferImageCapabilities(modelKey));
  return IMAGE_CAPABILITY_ORDER.filter((c) => caps.has(c)).map(
    (c) => IMAGE_CAPABILITY_LABELS[c],
  );
}

export function formatStoryboardImageModelTypeLabel(
  modelKey: string,
  role?: string,
): string {
  void role;
  const labels = getStoryboardImageModelTypeLabels(modelKey);
  return labels.length ? labels.join(" · ") : "生图";
}

export function isStoryboardImageEditModel(modelKey: string): boolean {
  return inferImageCapabilities(modelKey).includes("image_edit");
}
