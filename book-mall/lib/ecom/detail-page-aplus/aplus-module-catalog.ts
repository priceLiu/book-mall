import {
  DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL,
  DETAIL_PAGE_SUITE_SIZE_CHART_LINE_ART_LABEL,
  DETAIL_PAGE_SUITE_SIZE_CHART_MAX_NUM,
  DETAIL_PAGE_SUITE_SIZE_CHART_MODEL_COMPARE_LABEL,
} from "@/lib/ecom/detail-page-suite/size-chart-constants";
import {
  DETAIL_PAGE_SUITE_SPEC_CHART_COMPLIANCE_LABEL,
  DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL,
  DETAIL_PAGE_SUITE_SPEC_CHART_MAX_NUM,
  DETAIL_PAGE_SUITE_SPEC_CHART_PACKING_LABEL,
} from "@/lib/ecom/detail-page-suite/spec-table-constants";
import type { DetailPageSuiteModuleDef } from "@/lib/ecom/detail-page-suite/types";

function mod(
  module_id: string,
  module_name: string,
  max_num: number,
  subtitle: string,
  extra_pool: string[] = [],
): DetailPageSuiteModuleDef {
  return {
    module_id,
    module_name,
    required: false,
    max_num,
    candidate_pool: [subtitle, ...extra_pool],
  };
}

/** AI 详情页 · 16 模块（与产品稿图 1 名称/说明一致） */
export const AI_DETAIL_PAGE_MODULE_CATALOG: DetailPageSuiteModuleDef[] = [
  mod("aplus_hero", "首屏主视觉", 1, "传递核心价值"),
  mod("aplus_core_sp", "核心卖点图", 4, "突出差异点优势", [
    "单卖点大图，产品特写 + 留白排版",
    "双卖点分栏对比式呈现",
    "三卖点卡片网格",
    "多卖点汇总信息图",
  ]),
  mod("aplus_usage_scene", "使用场景图", 5, "呈现真实使用场景", [
    "居家场景",
    "户外场景",
    "办公场景",
    "通勤场景",
    "礼品/节日场景",
  ]),
  mod("aplus_multi_angle", "多角度图", 4, "多角度呈现外观", [
    "正面",
    "侧面",
    "背面",
    "45 度角",
  ]),
  mod("aplus_scene_atmo", "场景氛围图", 5, "展示使用场景", [
    "氛围主视觉",
    "生活方式场景 2",
    "生活方式场景 3",
    "生活方式场景 4",
    "生活方式场景 5",
  ]),
  mod("aplus_product_detail", "商品细节图", 6, "放大材质与工艺", [
    "材质肌理特写",
    "缝线/做工特写",
    "结构/五金特写",
    "功能部件特写",
    "标识/logo 特写",
    "局部工艺特写",
  ]),
  mod("aplus_brand_story", "品牌故事图", 2, "传达品牌理念", [
    "品牌理念氛围图",
    "品牌背书/资质展示",
  ]),
  {
    module_id: "aplus_size_capacity",
    module_name: "尺寸/容量/尺码图",
    required: false,
    max_num: DETAIL_PAGE_SUITE_SIZE_CHART_MAX_NUM,
    candidate_pool: [
      DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL,
      DETAIL_PAGE_SUITE_SIZE_CHART_LINE_ART_LABEL,
      DETAIL_PAGE_SUITE_SIZE_CHART_MODEL_COMPARE_LABEL,
    ],
  },
  mod("aplus_effect_compare", "效果对比图", 2, "使用前后效果对比", [
    "使用前后左右分栏",
    "本品 vs 普通款对比",
  ]),
  {
    module_id: "aplus_spec_table",
    module_name: "详细规格/参数表",
    required: false,
    max_num: DETAIL_PAGE_SUITE_SPEC_CHART_MAX_NUM,
    candidate_pool: [
      DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL,
      DETAIL_PAGE_SUITE_SPEC_CHART_PACKING_LABEL,
      DETAIL_PAGE_SUITE_SPEC_CHART_COMPLIANCE_LABEL,
    ],
  },
  mod("aplus_craft_process", "工艺制作图", 5, "展示工艺制作过程", [
    "工艺步骤 1",
    "工艺步骤 2",
    "工艺步骤 3",
    "工艺步骤 4",
    "工艺步骤 5",
  ]),
  mod("aplus_accessories", "配件/赠品图", 2, "明确收货的所有物品", [
    "配件平铺展示",
    "包装内含清单示意",
  ]),
  mod("aplus_series_display", "系列展示图", 4, "多色或多 SKU 展示", [
    "多色并排",
    "多 SKU 网格",
    "色卡/面料色块",
    "系列组合陈列",
  ]),
  mod("aplus_ingredients", "商品成分图", 3, "展示配方/材质/成分", [
    "成分/材质说明留白",
    "配方比例示意",
    "安全/认证标识区",
  ]),
  mod("aplus_aftersale", "售后保障图", 2, "说明质保退换政策", [
    "售后政策留白底图",
    "质保/退换说明底图",
  ]),
  mod("aplus_usage_tips", "使用建议图", 2, "商品使用的注意事项", [
    "使用步骤示意",
    "注意事项/养护说明留白",
  ]),
];

/** 加载旧项目时：历史 module_id → 现行 catalog id */
export const AI_DETAIL_PAGE_LEGACY_MODULE_ID_MAP: Record<string, string> = {
  aplus_title_banner: "aplus_hero",
  aplus_feature_1: "aplus_core_sp",
  aplus_feature_2: "aplus_core_sp",
  aplus_feature_3: "aplus_core_sp",
  aplus_four_highlights: "aplus_scene_atmo",
  aplus_single_highlights: "aplus_core_sp",
  aplus_image_sidebar: "aplus_core_sp",
  aplus_title_4: "aplus_hero",
  aplus_title_5: "aplus_hero",
  aplus_title_6: "aplus_hero",
  aplus_brand_logo: "aplus_brand_story",
  aplus_product_desc: "aplus_hero",
  aplus_compare_chart: "aplus_effect_compare",
  aplus_specs_detail: "aplus_spec_table",
  aplus_light_text: "aplus_hero",
  aplus_tech_specs: "aplus_spec_table",
  aplus_scene: "aplus_usage_scene",
  aplus_feature: "aplus_product_detail",
  aplus_compare: "aplus_effect_compare",
  aplus_specs: "aplus_spec_table",
  aplus_brand: "aplus_brand_story",
  aplus_service: "aplus_aftersale",
};

/** 稿图 1 默认勾选的前 6 项 */
export const AI_DETAIL_PAGE_DEFAULT_ENABLED = new Set([
  "aplus_hero",
  "aplus_core_sp",
  "aplus_usage_scene",
  "aplus_multi_angle",
  "aplus_scene_atmo",
  "aplus_product_detail",
]);

export function aplusModuleSubtitle(mod: DetailPageSuiteModuleDef): string {
  return mod.candidate_pool[0] ?? "";
}
