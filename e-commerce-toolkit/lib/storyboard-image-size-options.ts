/**
 * 生图模型 · 输出尺寸选项（StoryboardModelPickerDialog 唯一数据源）
 * 与 book-mall `ecom-storyboard-gen-params` / Gateway 厂商 size 对齐。
 */

export type StoryboardImageSizeOption = {
  value: string;
  label: string;
};

/** 万相 legacy / 通用 */
export const STORYBOARD_WANX_SIZE_OPTIONS: StoryboardImageSizeOption[] = [
  { value: "1080*1440", label: "1080×1440（3:4 · 1080P+）" },
  { value: "1152*1440", label: "1152×1440（4:5 · 1080P+）" },
  { value: "720*1280", label: "720×1280（9:16）" },
  { value: "1280*720", label: "1280×720（16:9）" },
  { value: "1440*810", label: "1440×810（16:9 · 1080P+）" },
  { value: "1024*1024", label: "1024×1024（1:1）" },
  { value: "1440*1440", label: "1440×1440（1:1 · 1080P+）" },
];

/** 百炼 Qwen Image 3.0 / Edit */
export const STORYBOARD_QWEN_IMAGE_SIZE_OPTIONS: StoryboardImageSizeOption[] = [
  { value: "1140*1472", label: "1140×1472（3:4）" },
  { value: "1080*1440", label: "1080×1440（3:4 · 1080P）" },
  { value: "928*1664", label: "928×1664（9:16）" },
  { value: "1664*928", label: "1664×928（16:9）" },
  { value: "1328*1328", label: "1328×1328（1:1）" },
  { value: "1024*1024", label: "1024×1024（1:1）" },
  { value: "1472*1140", label: "1472×1140（4:3）" },
];

/** 万相 2.6 / 2.7 多图参考 */
export const STORYBOARD_WAN27_IMAGE_SIZE_OPTIONS: StoryboardImageSizeOption[] = [
  { value: "960*1696", label: "960×1696（9:16）" },
  { value: "1696*960", label: "1696×960（16:9）" },
  { value: "1280*1280", label: "1280×1280（1:1）" },
  { value: "1080*1440", label: "1080×1440（3:4 · 映射）" },
  { value: "1152*1440", label: "1152×1440（4:5 · 映射）" },
];

/** KIE Nano Banana / Seedream */
export const STORYBOARD_KIE_IMAGE_RESOLUTION_OPTIONS: StoryboardImageSizeOption[] = [
  { value: "2K", label: "2K（推荐）" },
  { value: "4K", label: "4K" },
];

export type StoryboardWanxSize = string;

function normKey(modelKey: string): string {
  return modelKey.trim().toLowerCase();
}

export function isStoryboardQwenImageModel(modelKey: string): boolean {
  const k = normKey(modelKey);
  return k.includes("qwen-image");
}

export function isStoryboardWan27FamilyImageModel(modelKey: string): boolean {
  const k = normKey(modelKey);
  return k.startsWith("wan2.7-image") || k.startsWith("wan2.6-image");
}

export function isStoryboardKieImageModel(modelKey: string): boolean {
  const k = normKey(modelKey);
  return (
    k.includes("nano-banana") ||
    k.includes("seedream") ||
    k.includes("kie/") ||
    k === "nano-banana-pro"
  );
}

export function isStoryboardKlingImageModel(modelKey: string): boolean {
  return /kling.*image/i.test(modelKey.trim());
}

/** 可灵生图：仅比例，分辨率固定 2K */
export function imagePickerUsesAspectRatioOnly(modelKey: string): boolean {
  return isStoryboardKlingImageModel(modelKey);
}

export function imageSizeOptionsForModel(modelKey: string): StoryboardImageSizeOption[] {
  if (isStoryboardQwenImageModel(modelKey)) return STORYBOARD_QWEN_IMAGE_SIZE_OPTIONS;
  if (isStoryboardWan27FamilyImageModel(modelKey)) return STORYBOARD_WAN27_IMAGE_SIZE_OPTIONS;
  if (isStoryboardKieImageModel(modelKey)) return STORYBOARD_KIE_IMAGE_RESOLUTION_OPTIONS;
  return STORYBOARD_WANX_SIZE_OPTIONS;
}

export function defaultImageSizeForModel(
  modelKey: string,
  aspectRatio: "16:9" | "9:16" = "9:16",
): string {
  const opts = imageSizeOptionsForModel(modelKey);
  if (imagePickerUsesAspectRatioOnly(modelKey)) {
    return aspectRatio === "16:9" ? "16:9" : "9:16";
  }
  if (isStoryboardWan27FamilyImageModel(modelKey)) {
    return aspectRatio === "16:9" ? "1696*960" : "960*1696";
  }
  if (isStoryboardQwenImageModel(modelKey)) {
    return aspectRatio === "16:9" ? "1664*928" : "928*1664";
  }
  if (aspectRatio === "16:9") {
    return opts.find((o) => o.value.includes("1280*720") || o.value.includes("1440*810"))
      ?.value ?? opts[0]!.value;
  }
  return (
    opts.find((o) => o.value === "1080*1440" || o.value === "720*1280")?.value ??
    opts[0]!.value
  );
}

export function aspectRatioForImageSize(size: string): "16:9" | "9:16" | "1:1" | "3:4" | "4:5" {
  const s = size.trim();
  if (s === "16:9" || s === "9:16" || s === "1:1") {
    return s === "16:9" ? "16:9" : s === "1:1" ? "1:1" : "9:16";
  }
  if (s.includes("*")) {
    const [w, h] = s.split("*").map(Number);
    if (!w || !h) return "9:16";
    const r = w / h;
    if (Math.abs(r - 1) < 0.05) return "1:1";
    if (Math.abs(r - 16 / 9) < 0.08) return "16:9";
    if (Math.abs(r - 3 / 4) < 0.08) return "3:4";
    if (Math.abs(r - 4 / 5) < 0.08) return "4:5";
    return r < 1 ? "9:16" : "16:9";
  }
  return "9:16";
}

export function imageSizeToEcomRatio(size: string): "1:1" | "3:4" | "4:5" | "16:9" {
  const ar = aspectRatioForImageSize(size);
  if (ar === "1:1") return "1:1";
  if (ar === "16:9") return "16:9";
  if (ar === "4:5") return "4:5";
  return "3:4";
}
