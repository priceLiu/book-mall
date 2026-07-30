/** 与 book-mall/lib/media/subtitle-burn-in.ts 保持逻辑一致（canvas-web 独立包） */
export const BURN_IN_SUBTITLE_MAX_CHARS = 160;

export function normalizeSubtitleBurnInText(raw: string | undefined | null): string {
  if (!raw?.trim()) return "";
  let t = raw.replace(/\r\n/g, "\n").trim();
  if (t === "—" || t === "-") return "";

  const lines = t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^\d+\s+\d+\s*s?$/.test(l))
    .filter((l) => !/^镜\s*\d+/i.test(l));

  const pick =
    lines.find((l) => /[：:]/.test(l)) ??
    lines.find((l) => l.length <= BURN_IN_SUBTITLE_MAX_CHARS) ??
    lines[0] ??
    t.split("\n")[0]?.trim() ??
    "";

  return pick
    .replace(/-->/g, "→")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BURN_IN_SUBTITLE_MAX_CHARS);
}
