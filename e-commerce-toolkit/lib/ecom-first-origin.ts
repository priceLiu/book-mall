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

export function inferEcomFirstOriginFromUpload(
  via?: "paste" | "drop" | "picker" | string,
): EcomFirstOrigin {
  return via === "paste" ? "user-paste" : "user-upload";
}
