import { OUTDOOR_JACKET_MODULES } from "./category-seeds";
import { moduleStateFromTemplateDef } from "./module-init";
import { migrateSizeChartModule } from "./suite-migrate";
import { DETAIL_PAGE_SUITE_SIZE_MODULE_ID } from "./size-chart-constants";
import type { DetailPageSuiteModuleState, DetailPageSuiteState } from "./types";

function defaultSizeChartModule(): DetailPageSuiteModuleState {
  const seed = OUTDOOR_JACKET_MODULES.find(
    (m) => m.module_id === DETAIL_PAGE_SUITE_SIZE_MODULE_ID,
  );
  if (!seed) throw new Error("缺少尺码参考模块模板定义");
  return migrateSizeChartModule({
    ...moduleStateFromTemplateDef(seed),
    enable: true,
  });
}

/** 爆款 / 复刻工作台：尺码参考模块固定排在最后，行为与标准详情页套图一致 */
export function ensureDetailPageSuiteSizeChartModuleAtEnd(
  suite: DetailPageSuiteState,
): { suite: DetailPageSuiteState; changed: boolean } {
  const others = suite.modules.filter((m) => m.module_id !== DETAIL_PAGE_SUITE_SIZE_MODULE_ID);
  const prev = suite.modules.find((m) => m.module_id === DETAIL_PAGE_SUITE_SIZE_MODULE_ID);
  const seed = OUTDOOR_JACKET_MODULES.find(
    (m) => m.module_id === DETAIL_PAGE_SUITE_SIZE_MODULE_ID,
  )!;
  const base = prev
    ? migrateSizeChartModule({
        ...moduleStateFromTemplateDef(seed),
        ...prev,
        enable: true,
        generate_count: Math.max(prev.generate_count || 0, 1),
      })
    : defaultSizeChartModule();
  const sizeMod: DetailPageSuiteModuleState = {
    ...base,
    enable: true,
    generate_count: Math.max(base.generate_count, 1),
  };
  const modules = [...others, sizeMod];
  const changed =
    suite.modules.length !== modules.length ||
    suite.modules[suite.modules.length - 1]?.module_id !== DETAIL_PAGE_SUITE_SIZE_MODULE_ID ||
    JSON.stringify(prev) !== JSON.stringify(sizeMod);
  return { suite: { ...suite, modules }, changed };
}
