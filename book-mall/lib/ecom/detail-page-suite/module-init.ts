import type { DetailPageSuiteModuleDef, DetailPageSuiteModuleState } from "./types";
import {
  DETAIL_PAGE_SUITE_SIZE_CHART_DEFAULT_COUNT,
  isDetailPageSuiteSizeChartModuleId,
} from "./size-chart-constants";
import {
  DETAIL_PAGE_SUITE_SPEC_CHART_DEFAULT_COUNT,
  isDetailPageSuiteSpecChartModuleId,
} from "./spec-table-constants";

export function defaultGenerateCountForModule(
  moduleId: string,
  maxNum: number,
): number {
  if (isDetailPageSuiteSizeChartModuleId(moduleId)) {
    return Math.min(DETAIL_PAGE_SUITE_SIZE_CHART_DEFAULT_COUNT, maxNum);
  }
  if (isDetailPageSuiteSpecChartModuleId(moduleId)) {
    return Math.min(DETAIL_PAGE_SUITE_SPEC_CHART_DEFAULT_COUNT, maxNum);
  }
  return maxNum;
}

export function moduleStateFromTemplateDef(
  m: DetailPageSuiteModuleDef,
): DetailPageSuiteModuleState {
  const generate_count = defaultGenerateCountForModule(m.module_id, m.max_num);
  const pool = [...m.candidate_pool];
  return {
    module_id: m.module_id,
    module_name: m.module_name,
    enable: true,
    generate_count,
    max_num: m.max_num,
    select_mode: "manual",
    candidate_pool: pool,
    selected_item_list: pool.slice(0, generate_count),
    slots: [],
  };
}
