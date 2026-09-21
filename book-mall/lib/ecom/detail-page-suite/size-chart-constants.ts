export const DETAIL_PAGE_SUITE_SIZE_MODULE_ID = "mod7_size_table";

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
