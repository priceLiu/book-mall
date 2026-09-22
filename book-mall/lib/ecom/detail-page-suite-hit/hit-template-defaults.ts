/** 与 docs/ecom/爆款结构复制.md 组件枚举一致（避免 hit-schemas 循环依赖） */
export const HIT_DEFAULT_LAYOUT = {
  full_banner: "full_image",
  main_product: "image_text_top_bottom",
  feature_card: "image_text_top_bottom",
  spec_table: "table",
  detail_closeup: "full_image",
  scene_image: "image_text_top_bottom",
  contrast: "image_text_left_right",
  after_sale: "text_only",
  other: "image_text_top_bottom",
} as const;

export const HIT_DEFAULT_TEXT_SLOT = {
  full_banner: { max_char: 18, text_type: "banner钩子" },
  main_product: { max_char: 24, text_type: "主视觉短标题" },
  feature_card: { max_char: 36, text_type: "卖点利益" },
  spec_table: { max_char: 80, text_type: "参数说明" },
  detail_closeup: { max_char: 40, text_type: "细节解说" },
  scene_image: { max_char: 28, text_type: "场景氛围" },
  contrast: { max_char: 48, text_type: "对比说明" },
  after_sale: { max_char: 60, text_type: "售后保障" },
  other: { max_char: 36, text_type: "模块文案" },
} as const;

export const HIT_TYPE_ALIASES: Record<string, keyof typeof HIT_DEFAULT_LAYOUT> = {
  banner: "full_banner",
  full_banner: "full_banner",
  首屏: "full_banner",
  海报: "full_banner",
  main: "main_product",
  main_product: "main_product",
  主图: "main_product",
  feature: "feature_card",
  feature_card: "feature_card",
  卖点: "feature_card",
  spec: "spec_table",
  spec_table: "spec_table",
  参数: "spec_table",
  尺码: "spec_table",
  detail: "detail_closeup",
  detail_closeup: "detail_closeup",
  细节: "detail_closeup",
  scene: "scene_image",
  scene_image: "scene_image",
  场景: "scene_image",
  contrast: "contrast",
  对比: "contrast",
  after_sale: "after_sale",
  售后: "after_sale",
  other: "other",
};

export const HIT_LAYOUT_ALIASES: Record<string, string> = {
  full: "full_image",
  full_image: "full_image",
  全屏: "full_image",
  top_bottom: "image_text_top_bottom",
  image_text_top_bottom: "image_text_top_bottom",
  上图下文: "image_text_top_bottom",
  left_right: "image_text_left_right",
  image_text_left_right: "image_text_left_right",
  左图右文: "image_text_left_right",
  text: "text_only",
  text_only: "text_only",
  table: "table",
  表格: "table",
};

export const HIT_REPEAT_LIMITS_COPY =
  "repeat_count 须如实反映长图中该类型连续块/卡位数量（每种 type 1～99）；用户可在工作台自行增删，服务端不再按类型截断。";
