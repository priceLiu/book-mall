export const HIT_COMPONENT_TYPES = [
  "full_banner",
  "main_product",
  "feature_card",
  "spec_table",
  "detail_closeup",
  "scene_image",
  "contrast",
  "after_sale",
  "other",
] as const;

export type HitComponentType = (typeof HIT_COMPONENT_TYPES)[number];

export const HIT_LAYOUTS = [
  "full_image",
  "image_text_top_bottom",
  "image_text_left_right",
  "text_only",
  "table",
] as const;

export type HitLayout = (typeof HIT_LAYOUTS)[number];

export const HIT_COMPONENT_LABELS: Record<HitComponentType, string> = {
  full_banner: "全屏首屏海报",
  main_product: "主视觉产品展示",
  feature_card: "核心卖点卡位",
  spec_table: "参数规格",
  detail_closeup: "产品细节特写",
  scene_image: "场景穿搭展示",
  contrast: "产品对比",
  after_sale: "售后保障",
  other: "自定义模块",
};

export const HIT_LAYOUT_LABELS: Record<HitLayout, string> = {
  full_image: "全屏通图",
  image_text_top_bottom: "上图下文",
  image_text_left_right: "左图右文",
  text_only: "纯文本标题",
  table: "表格布局",
};

export const HIT_REPEATABLE_TYPES = new Set<HitComponentType>([
  "feature_card",
  "detail_closeup",
  "scene_image",
]);

export function maxRepeatForHitType(type: HitComponentType): number {
  if (type === "feature_card") return 6;
  if (type === "detail_closeup" || type === "scene_image") return 8;
  return 4;
}

export type HitComponent = {
  id: string;
  type: HitComponentType;
  layout: HitLayout;
  repeat_count: number;
  user_editable_count?: boolean;
  note?: string;
  text_slot?: { max_char?: number; text_type?: string };
  image_slot?: { composition?: string; need_scene_bg?: boolean };
};

export type HitCopyParadigm = {
  pain_points?: string[];
  narrative_order?: string[];
  module_copy_roles?: string[];
  tone?: string;
};

/** 竞品爆款洞察（方向性标签，非原文） */
export type HitMarketInsight = {
  hot_selling_dimensions?: string[];
  user_pain_points?: string[];
  narrative_sequence?: string;
  copy_style?: string;
  module_copy_functions?: string[];
};

export type HitGlobalStyle = {
  scene_environment?: string;
  scene_theme?: string;
  light_style?: string;
  color_tone?: string;
  composition_style?: string;
  picture_atmosphere?: string;
  photo_style?: string;
  prop_style?: string;
  clarity_texture?: string;
};

export type HitTemplate = {
  schemaVersion?: string;
  template_name: string;
  canvas_width?: number;
  category_tag?: string[];
  market_insight?: HitMarketInsight;
  global_style?: HitGlobalStyle;
  global_copy_style?: string;
  copy_paradigm?: HitCopyParadigm;
  component_list: HitComponent[];
};

export const HIT_COMPLIANCE_COPY =
  "本工具仅提取版式叙事逻辑，不复制竞品图文素材；上架商品图文需由用户保证版权合规。";

export function readHitTemplate(raw: unknown): HitTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.template_name !== "string" || !Array.isArray(o.component_list)) return null;
  return raw as HitTemplate;
}

export function readHitCopyParadigm(raw: unknown): HitCopyParadigm | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as HitCopyParadigm;
}
