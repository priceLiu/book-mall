import type { HitGlobalStyle, HitMarketInsight } from "@/lib/detail-page-suite-hit-types";

export const HIT_GLOBAL_STYLE_FIELDS = [
  "scene_environment",
  "light_style",
  "color_tone",
  "composition_style",
  "picture_atmosphere",
  "prop_style",
  "clarity_texture",
] as const;

export type HitGlobalStyleField = (typeof HIT_GLOBAL_STYLE_FIELDS)[number];

export const HIT_GLOBAL_STYLE_LABELS: Record<HitGlobalStyleField, string> = {
  scene_environment: "场景环境",
  light_style: "光影类型",
  color_tone: "整体色调",
  composition_style: "构图方式",
  picture_atmosphere: "画面氛围",
  prop_style: "道具风格",
  clarity_texture: "清晰度质感",
};

export function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function arrayToLines(items: string[] | undefined): string {
  return (items ?? []).join("\n");
}

export function patchMarketInsight(
  insight: HitMarketInsight | undefined,
  patch: Partial<HitMarketInsight>,
): HitMarketInsight {
  return { ...(insight ?? {}), ...patch };
}

export function patchGlobalStyle(
  style: HitGlobalStyle | undefined,
  key: HitGlobalStyleField,
  value: string,
): HitGlobalStyle {
  const next = { ...(style ?? {}) };
  const t = value.trim();
  if (t) next[key] = t;
  else delete next[key];
  return next;
}
