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
