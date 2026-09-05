const SHOT_SCALE_ALIASES: Record<string, string> = {
  远景: "远景",
  大全景: "大全景",
  全景: "全景",
  中全景: "中全景",
  中景: "中景",
  中近景: "中近景",
  近景: "近景",
  特写: "特写",
  大特写: "大特写",
  微距特写: "微距特写",
};

const CUT_TRANSITION_ALIASES: Record<string, string> = {
  硬切: "硬切",
  切: "硬切",
  叠化: "叠化",
  闪白: "闪白",
  推切: "推切",
  甩切: "甩切",
  淡入淡出: "淡入淡出",
  淡入: "淡入淡出",
  淡出: "淡入淡出",
};

export function normalizeShotScale(raw: string): string {
  const t = raw.trim();
  if (!t) return "中景";
  for (const [key, val] of Object.entries(SHOT_SCALE_ALIASES)) {
    if (t.includes(key)) return val;
  }
  return t;
}

export function normalizeCutTransition(raw: string): string {
  const t = raw.trim();
  if (!t) return "硬切";
  for (const [key, val] of Object.entries(CUT_TRANSITION_ALIASES)) {
    if (t === key || t.includes(key)) return val;
  }
  return t;
}

export function normalizeCameraMovement(raw: string): string {
  const t = raw.trim();
  if (!t || t === "无") return "固定机位";
  return t;
}

export function clampFilmPullDurationSec(n: number, fallback = 5): number {
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(0.5, Math.min(30, Math.round(n * 100) / 100));
}
