export const ECOM_FIRST_ORIGINS = [
  "user-upload",
  "user-paste",
  "web",
  "ecom",
  "canvas",
  "story",
  "tool",
] as const;

export type EcomFirstOrigin = (typeof ECOM_FIRST_ORIGINS)[number];

export function parseEcomFirstOrigin(raw: unknown): EcomFirstOrigin | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return (ECOM_FIRST_ORIGINS as readonly string[]).includes(value)
    ? (value as EcomFirstOrigin)
    : undefined;
}

/** 粘贴 / 本地选文件自动打标；拖入本地文件按上传计。 */
export function inferEcomFirstOriginFromUpload(
  via?: "paste" | "drop" | "picker" | string,
): EcomFirstOrigin {
  return via === "paste" ? "user-paste" : "user-upload";
}

/** 首次来源只写一次。 */
export function firstWriteOrigin(
  existing?: string | null,
  incoming?: string | null,
): EcomFirstOrigin | undefined {
  return parseEcomFirstOrigin(existing) ?? parseEcomFirstOrigin(incoming);
}
