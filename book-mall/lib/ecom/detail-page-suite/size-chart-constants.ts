export const DETAIL_PAGE_SUITE_SIZE_MODULE_ID = "mod7_size_table";

/** AI 详情页 · 尺寸/容量/尺码图（与 mod7 共用尺码表输入与程序化出图） */
export const AI_DETAIL_PAGE_SIZE_MODULE_ID = "aplus_size_capacity";

export function isDetailPageSuiteSizeChartModuleId(moduleId: string): boolean {
  return (
    moduleId === DETAIL_PAGE_SUITE_SIZE_MODULE_ID ||
    moduleId === AI_DETAIL_PAGE_SIZE_MODULE_ID
  );
}

/** 系统子维度：程序化尺码表出图（不走 LLM / 文生图） */
export const DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL = "尺码数据总表图";

export const DETAIL_PAGE_SUITE_SIZE_CHART_LINE_ART_LABEL = "服装测量部位线稿示意图";

export const DETAIL_PAGE_SUITE_SIZE_CHART_MODEL_COMPARE_LABEL =
  "多身高模特上身试穿参考图";

export const DETAIL_PAGE_SUITE_SIZE_CHART_DEFAULT_COUNT = 1;

export const DETAIL_PAGE_SUITE_SIZE_CHART_MAX_NUM = 6;

/** 存库 positive_prompt 占位，出图走代码渲染 */
export const DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER = "[detail-page-suite:size-chart-render]";

export function isDetailPageSuiteSizeChartDataLabel(itemLabel: string | undefined): boolean {
  const label = itemLabel?.trim() ?? "";
  return (
    label === DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL ||
    label.startsWith("尺码数据总表")
  );
}
