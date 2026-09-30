/** 占位标题 · UI 展示为「图片 N」，不占用用户自定义 `data.label` */
export const LIBTV_IMAGE_GENERIC_TITLE_LABELS = new Set(["图片"]);

export function libtvImageNodeDisplayLabel(
  stored: string | undefined,
  defaultLabel: string,
): string {
  const t = String(stored ?? "").trim();
  if (!t || LIBTV_IMAGE_GENERIC_TITLE_LABELS.has(t)) return defaultLabel;
  return t;
}
