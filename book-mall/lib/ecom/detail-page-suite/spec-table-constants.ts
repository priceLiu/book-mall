/** AI 详情页 · 详细规格/参数表（程序化参数表 + 其余子维度走 LLM） */
export const AI_DETAIL_PAGE_SPEC_MODULE_ID = "aplus_spec_table";

export const DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL = "商品参数总表图";

export const DETAIL_PAGE_SUITE_SPEC_CHART_PACKING_LABEL = "包装清单平铺";

export const DETAIL_PAGE_SUITE_SPEC_CHART_COMPLIANCE_LABEL = "合规/认证信息留白";

export const DETAIL_PAGE_SUITE_SPEC_CHART_DEFAULT_COUNT = 1;

export const DETAIL_PAGE_SUITE_SPEC_CHART_MAX_NUM = 6;

export const DETAIL_PAGE_SUITE_SPEC_CHART_PROMPT_MARKER =
  "[detail-page-suite:spec-table-render]";

export function isDetailPageSuiteSpecChartModuleId(moduleId: string): boolean {
  return moduleId === AI_DETAIL_PAGE_SPEC_MODULE_ID;
}

export function isDetailPageSuiteSpecChartDataLabel(itemLabel: string | undefined): boolean {
  const label = itemLabel?.trim() ?? "";
  return (
    label === DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL ||
    label.startsWith("商品参数总表")
  );
}
