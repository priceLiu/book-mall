import type { HitGlobalStyle, HitMarketInsight } from "./hit-schemas";

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

export function formatHitGlobalStyleForLlm(style: HitGlobalStyle | undefined): string {
  if (!style) return "（未拆解视觉氛围，请先完成竞品长图拆解）";
  const lines = HIT_GLOBAL_STYLE_FIELDS.map((key) => {
    const v = style[key]?.trim();
    return v ? `${HIT_GLOBAL_STYLE_LABELS[key]}：${v}` : null;
  }).filter(Boolean);
  return lines.length ? lines.join("\n") : "（视觉氛围字段为空）";
}

export function formatMarketInsightForLlm(insight: HitMarketInsight | undefined): string {
  if (!insight) return "（未拆解爆款洞察）";
  const parts: string[] = [];
  if (insight.hot_selling_dimensions?.length) {
    parts.push(
      `爆款卖点维度（宣传方向，非原文）：\n${insight.hot_selling_dimensions.map((s) => `- ${s}`).join("\n")}`,
    );
  }
  if (insight.user_pain_points?.length) {
    parts.push(
      `类目用户痛点：\n${insight.user_pain_points.map((s) => `- ${s}`).join("\n")}`,
    );
  }
  if (insight.narrative_sequence?.trim()) {
    parts.push(`叙事顺序：${insight.narrative_sequence.trim()}`);
  }
  if (insight.copy_style?.trim()) {
    parts.push(`文案口吻：${insight.copy_style.trim()}`);
  }
  if (insight.module_copy_functions?.length) {
    parts.push(
      `各模块核心文案功能（抽象钩子，非竞品原句）：\n${insight.module_copy_functions.map((s) => `- ${s}`).join("\n")}`,
    );
  }
  return parts.length ? parts.join("\n\n") : "（爆款洞察字段为空）";
}
