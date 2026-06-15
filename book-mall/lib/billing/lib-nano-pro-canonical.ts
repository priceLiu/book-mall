/**
 * KIE nano-banana-pro（Gateway canonical: lib-nano-pro）· 按清晰度分档计费
 */
export const LIB_NANO_PRO_TIER_CANONICALS = {
  "1K": "lib-nano-pro-1k",
  "2K": "lib-nano-pro-2k",
  "4K": "lib-nano-pro-4k",
} as const;

export type LibNanoProResolution = keyof typeof LIB_NANO_PRO_TIER_CANONICALS;

export function normalizeLibNanoProResolution(
  resolution?: string | null,
): LibNanoProResolution {
  const r = (resolution ?? "2K").trim().toUpperCase();
  if (r === "1K") return "1K";
  if (r === "4K") return "4K";
  return "2K";
}

export function libNanoProCanonicalFromResolution(
  resolution?: string | null,
): string {
  return LIB_NANO_PRO_TIER_CANONICALS[normalizeLibNanoProResolution(resolution)];
}

/** modelKey / canonical 命中 nano-banana 或 lib-nano-pro 时，按 resolution 返回分档 canonical */
export function libNanoProCanonicalFromModelKey(
  modelKey?: string | null,
  resolution?: string | null,
): string | null {
  const mk = modelKey?.trim().toLowerCase() ?? "";
  if (
    !mk.includes("nano-banana") &&
    mk !== "lib-nano-pro" &&
    !mk.startsWith("lib-nano-pro-")
  ) {
    return null;
  }
  if (mk.startsWith("lib-nano-pro-")) return mk;
  return libNanoProCanonicalFromResolution(resolution);
}
