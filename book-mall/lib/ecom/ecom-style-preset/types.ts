/** 全站统一预置风格库 · 条目 kind */
export type EcomStylePresetKind = "sellpoint_layout" | "trending_visual";

/** 与 Pro vertical / 故事版长期对齐 */
export type EcomStylePresetVertical =
  | "fashion_apparel"
  | "bags"
  | "digital_3c"
  | "footwear"
  | "jewelry"
  | "outdoor_gear"
  | "loungewear"
  | "kitchenware"
  | "baby_maternal"
  | "generic";

export type EcomStylePreset = {
  id: string;
  kind: EcomStylePresetKind;
  /** 空数组表示全垂直可用 */
  verticals: EcomStylePresetVertical[];
  title: string;
  subtitle?: string;
  /** UI 色点 */
  palette?: string[];
  /** 列表缩略（可选；无则前端占位） */
  thumbUrl?: string;
  /** 卖点版式：排版结构 prompt */
  layoutPrompt?: string;
  /** 爆款风格：视觉氛围 prompt */
  visualPrompt?: string;
  sortOrder: number;
};

export const ECOM_STYLE_PRESET_CATALOG_VERSION = "2026-09-30.2";
