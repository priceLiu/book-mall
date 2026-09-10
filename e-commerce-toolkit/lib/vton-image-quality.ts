/** 模特试衣 · wan2.7-image-pro 全身生图（3:4）输出尺寸 */

export type VtonModelImageSize = (typeof VTON_MODEL_IMAGE_SIZE_VALUES)[number];

export const VTON_MODEL_IMAGE_SIZE_VALUES = [
  "720*960",
  "1080*1440",
  "1536*2048",
] as const;

export const VTON_DEFAULT_MODEL_IMAGE_SIZE: VtonModelImageSize = "720*960";

export type VtonModelImageQualityOption = {
  value: VtonModelImageSize;
  label: string;
};

export const VTON_MODEL_IMAGE_QUALITY_OPTIONS: VtonModelImageQualityOption[] = [
  { value: "720*960", label: "720P" },
  { value: "1080*1440", label: "1080P" },
  { value: "1536*2048", label: "2K" },
];

export function coerceVtonModelImageSize(raw: string | undefined | null): VtonModelImageSize {
  const v = raw?.trim();
  if (v && (VTON_MODEL_IMAGE_SIZE_VALUES as readonly string[]).includes(v)) {
    return v as VtonModelImageSize;
  }
  return VTON_DEFAULT_MODEL_IMAGE_SIZE;
}

export function parseVtonModelImagePixelSize(
  size: VtonModelImageSize = VTON_DEFAULT_MODEL_IMAGE_SIZE,
): { width: number; height: number } {
  const [widthRaw, heightRaw] = size.split("*");
  const width = Number(widthRaw);
  const height = Number(heightRaw);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return { width: 720, height: 960 };
  }
  return { width, height };
}

/**
 * 试衣成片（aitryon-plus resolution=-1）与模特底图同尺寸；网格按此比例展示。
 */
export function vtonTryonResultAspectRatio(
  size: VtonModelImageSize = VTON_DEFAULT_MODEL_IMAGE_SIZE,
): number {
  const { width, height } = parseVtonModelImagePixelSize(size);
  return width / height;
}

export function vtonTryonResultAspectStyle(
  size: VtonModelImageSize = VTON_DEFAULT_MODEL_IMAGE_SIZE,
): { aspectRatio: string } {
  const { width, height } = parseVtonModelImagePixelSize(size);
  return { aspectRatio: `${width} / ${height}` };
}

/** 文生试衣等 · 按成片像素或出图比例设置格子 aspect-ratio */
export function vtonDynamicResultAspectStyle(opts: {
  width?: number;
  height?: number;
  ratio?: string;
  fallbackRatio?: string;
}): { aspectRatio: string } {
  const width = opts.width;
  const height = opts.height;
  if (typeof width === "number" && typeof height === "number" && width > 0 && height > 0) {
    return { aspectRatio: `${width} / ${height}` };
  }
  const ratio = opts.ratio?.trim() || opts.fallbackRatio?.trim() || "3:4";
  switch (ratio) {
    case "3:4":
      return { aspectRatio: "3 / 4" };
    case "4:5":
      return { aspectRatio: "4 / 5" };
    case "16:9":
      return { aspectRatio: "16 / 9" };
    case "9:16":
      return { aspectRatio: "9 / 16" };
    case "1:1":
      return { aspectRatio: "1 / 1" };
    default:
      return { aspectRatio: "3 / 4" };
  }
}
