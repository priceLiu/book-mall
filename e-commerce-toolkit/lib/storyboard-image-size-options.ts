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
  { value: "720*960", label: "720×960（3:4 · 720P）" },
  { value: "1080*1440", label: "1080×1440（3:4 · 1080P+）" },
  { value: "1140*1472", label: "1140×1472（3:4 · 高清）" },
  { value: "1536*2048", label: "1536×2048（3:4 · 2K）" },
  { value: "960*1200", label: "960×1200（4:5）" },
  { value: "1152*1440", label: "1152×1440（4:5 · 1080P+）" },
  { value: "720*1280", label: "720×1280（9:16 · 720P）" },
  { value: "1080*1920", label: "1080×1920（9:16 · 1080P）" },
  { value: "1280*720", label: "1280×720（16:9 · 720P）" },
  { value: "1440*810", label: "1440×810（16:9 · 1080P+）" },
  { value: "1920*1080", label: "1920×1080（16:9 · 1080P+）" },
  { value: "1024*1024", label: "1024×1024（1:1）" },
  { value: "1440*1440", label: "1440×1440（1:1 · 1080P+）" },
  { value: "1536*1536", label: "1536×1536（1:1 · 2K）" },
];

/** 百炼 Qwen Image 3.0 / Edit — 厂商允许 512²～2048² 内任意宽高比 */
export const STORYBOARD_QWEN_IMAGE_SIZE_OPTIONS: StoryboardImageSizeOption[] = [
  { value: "720*960", label: "720×960（3:4 · 720P）" },
  { value: "900*1200", label: "900×1200（3:4）" },
  { value: "1080*1440", label: "1080×1440（3:4 · 1080P）" },
  { value: "1140*1472", label: "1140×1472（3:4 · 推荐）" },
  { value: "1320*1760", label: "1320×1760（3:4 · 高清）" },
  { value: "1536*2048", label: "1536×2048（3:4 · 2K）" },
  { value: "960*1200", label: "960×1200（4:5）" },
  { value: "1152*1440", label: "1152×1440（4:5 · 1080P+）" },
  { value: "720*1280", label: "720×1280（9:16 · 720P）" },
  { value: "928*1664", label: "928×1664（9:16）" },
  { value: "1080*1920", label: "1080×1920（9:16 · 1080P）" },
  { value: "1152*2048", label: "1152×2048（9:16 · 2K）" },
  { value: "1280*720", label: "1280×720（16:9 · 720P）" },
  { value: "1440*810", label: "1440×810（16:9 · 1080P）" },
  { value: "1664*928", label: "1664×928（16:9）" },
  { value: "1920*1080", label: "1920×1080（16:9 · 1080P+）" },
  { value: "2048*1152", label: "2048×1152（16:9 · 2K）" },
  { value: "1024*1024", label: "1024×1024（1:1）" },
  { value: "1328*1328", label: "1328×1328（1:1）" },
  { value: "1440*1440", label: "1440×1440（1:1 · 1080P+）" },
  { value: "1536*1536", label: "1536×1536（1:1 · 2K）" },
  { value: "2048*2048", label: "2048×2048（1:1 · 最大）" },
  { value: "1472*1140", label: "1472×1140（4:3）" },
];

/** 万相 2.6 / 2.7 多图参考 */
export const STORYBOARD_WAN27_IMAGE_SIZE_OPTIONS: StoryboardImageSizeOption[] = [
  { value: "720*1280", label: "720×1280（9:16 · 720P）" },
  { value: "960*1696", label: "960×1696（9:16 · 默认）" },
  { value: "1080*1920", label: "1080×1920（9:16 · 1080P）" },
  { value: "1280*720", label: "1280×720（16:9 · 720P）" },
  { value: "1696*960", label: "1696×960（16:9 · 默认）" },
  { value: "1920*1080", label: "1920×1080（16:9 · 1080P）" },
  { value: "1024*1024", label: "1024×1024（1:1）" },
  { value: "1280*1280", label: "1280×1280（1:1 · 高清）" },
  { value: "720*960", label: "720×960（3:4 · 720P · 映射）" },
  { value: "1080*1440", label: "1080×1440（3:4 · 1080P · 映射）" },
  { value: "1140*1472", label: "1140×1472（3:4 · 高清 · 映射）" },
  { value: "1536*2048", label: "1536×2048（3:4 · 2K · 映射）" },
  { value: "960*1200", label: "960×1200（4:5 · 映射）" },
  { value: "1152*1440", label: "1152×1440（4:5 · 1080P+ · 映射）" },
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

/** 可灵生图 · 分辨率档位（比例由业务或 lockedImageSizeLabel 锁定） */
export const STORYBOARD_KLING_IMAGE_RESOLUTION_OPTIONS: StoryboardImageSizeOption[] = [
  { value: "1k", label: "1K" },
  { value: "2k", label: "2K（推荐）" },
];

/** 可灵生图：无 locked 比例时走比例下拉；有 locked 时走分辨率档位 */
export function imagePickerUsesAspectRatioOnly(
  modelKey: string,
  opts?: { lockedRatio?: boolean },
): boolean {
  if (opts?.lockedRatio) return false;
  return isStoryboardKlingImageModel(modelKey);
}

export function imageSizeOptionsForModel(
  modelKey: string,
  opts?: { lockedRatio?: boolean },
): StoryboardImageSizeOption[] {
  if (isStoryboardKlingImageModel(modelKey) && opts?.lockedRatio) {
    return STORYBOARD_KLING_IMAGE_RESOLUTION_OPTIONS;
  }
  if (isStoryboardQwenImageModel(modelKey)) return STORYBOARD_QWEN_IMAGE_SIZE_OPTIONS;
  if (isStoryboardWan27FamilyImageModel(modelKey)) return STORYBOARD_WAN27_IMAGE_SIZE_OPTIONS;
  if (isStoryboardKieImageModel(modelKey)) return STORYBOARD_KIE_IMAGE_RESOLUTION_OPTIONS;
  return STORYBOARD_WANX_SIZE_OPTIONS;
}

export function defaultImageSizeForModel(
  modelKey: string,
  aspectRatio: "16:9" | "9:16" | "3:4" | "4:5" | "1:1" = "9:16",
  opts?: { lockedRatio?: boolean },
): string {
  if (isStoryboardKlingImageModel(modelKey) && opts?.lockedRatio) {
    return "2k";
  }
  const pickerOpts = imageSizeOptionsForModel(modelKey, { lockedRatio: opts?.lockedRatio });
  if (imagePickerUsesAspectRatioOnly(modelKey)) {
    return aspectRatio === "16:9" ? "16:9" : aspectRatio === "1:1" ? "1:1" : "9:16";
  }
  const filtered = filterImageSizeOptionsByEcomRatio(pickerOpts, aspectRatio);
  if (filtered.length > 0) {
    const preferred =
      filtered.find((o) => o.value === "1080*1440") ??
      filtered.find((o) => o.label.includes("1080P")) ??
      filtered.find((o) => o.label.includes("推荐")) ??
      filtered[0];
    return preferred!.value;
  }
  if (isStoryboardWan27FamilyImageModel(modelKey)) {
    return aspectRatio === "16:9" ? "1696*960" : "960*1696";
  }
  if (aspectRatio === "16:9") {
    return pickerOpts.find((o) => o.value.includes("1280*720") || o.value.includes("1440*810"))
      ?.value ?? pickerOpts[0]!.value;
  }
  return (
    pickerOpts.find((o) => o.value === "1080*1440" || o.value === "720*1280")?.value ??
    pickerOpts[0]!.value
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

/** 按电商比例过滤像素尺寸（平台锁定比例时仍可选具体分辨率） */
export function filterImageSizeOptionsByEcomRatio(
  options: StoryboardImageSizeOption[],
  ratio?: string,
): StoryboardImageSizeOption[] {
  if (!ratio?.trim()) return options;
  const r = ratio.trim();
  const target =
    r === "1:1" ? "1:1" : r === "16:9" ? "16:9" : r === "4:5" ? "4:5" : "3:4";
  const filtered = options.filter((o) => aspectRatioForImageSize(o.value) === target);
  return filtered.length > 0 ? filtered : options;
}
