import {
  resolveModuleDisplaySlots,
  syncModuleSlotsFromSelection,
} from "./module-slots";
import { defaultGenerateCountForModule } from "./module-init";
import {
  buildProgrammaticSizeChartSlot,
} from "./size-chart-prompt";
import {
  DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL,
  DETAIL_PAGE_SUITE_SIZE_CHART_LINE_ART_LABEL,
  DETAIL_PAGE_SUITE_SIZE_CHART_MAX_NUM,
  DETAIL_PAGE_SUITE_SIZE_CHART_MODEL_COMPARE_LABEL,
  DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER,
  DETAIL_PAGE_SUITE_SIZE_MODULE_ID,
  isDetailPageSuiteSizeChartDataLabel,
} from "./size-chart-constants";
import { ensureBriefSizeChartDefaults } from "./size-chart-image";
import type {
  DetailPageSuiteBrief,
  DetailPageSuiteModuleState,
  DetailPageSuiteProject,
  DetailPageSuiteState,
} from "./types";

const LEGACY_SIZE_POOL_MARKERS = ["尺码表空白底图", "空白底图，浅纯色", "预留表格区域"];

export const SIZE_CHART_CANDIDATE_POOL = [
  DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL,
  DETAIL_PAGE_SUITE_SIZE_CHART_LINE_ART_LABEL,
  DETAIL_PAGE_SUITE_SIZE_CHART_MODEL_COMPARE_LABEL,
] as const;

function isLegacySizeChartLabel(label: string): boolean {
  const t = label.trim();
  if (!t) return false;
  if (t === DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL) return false;
  return (
    t.includes("尺码表空白") ||
    t.includes("空白底图") ||
    LEGACY_SIZE_POOL_MARKERS.some((m) => t.includes(m))
  );
}

function mapLegacySizeLabel(label: string): string {
  if (isLegacySizeChartLabel(label)) return DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL;
  return label.trim();
}

export function isLegacySizeChartModule(mod: DetailPageSuiteModuleState): boolean {
  if (mod.module_id !== DETAIL_PAGE_SUITE_SIZE_MODULE_ID) return false;
  if (mod.max_num < DETAIL_PAGE_SUITE_SIZE_CHART_MAX_NUM) return true;
  if (mod.module_name.trim() === "尺码表") return true;
  if (mod.candidate_pool.some((p) => isLegacySizeChartLabel(p))) return true;
  if (mod.selected_item_list.some((p) => isLegacySizeChartLabel(p))) return true;
  const poolSet = new Set(mod.candidate_pool);
  for (const required of SIZE_CHART_CANDIDATE_POOL) {
    if (!poolSet.has(required)) return true;
  }
  return false;
}

export function migrateSizeChartModule(
  mod: DetailPageSuiteModuleState,
): DetailPageSuiteModuleState {
  const max_num = DETAIL_PAGE_SUITE_SIZE_CHART_MAX_NUM;
  const generate_count = Math.min(
    Math.max(mod.generate_count || defaultGenerateCountForModule(mod.module_id, max_num), 1),
    max_num,
  );
  const selected = mod.selected_item_list
    .map(mapLegacySizeLabel)
    .filter((l, i, arr) => arr.indexOf(l) === i)
    .slice(0, generate_count);
  if (selected.length < generate_count) {
    for (const item of SIZE_CHART_CANDIDATE_POOL) {
      if (selected.length >= generate_count) break;
      if (!selected.includes(item)) selected.push(item);
    }
  }

  const synced = syncModuleSlotsFromSelection({
    ...mod,
    module_name: "尺码参考模块",
    max_num,
    generate_count,
    candidate_pool: [...SIZE_CHART_CANDIDATE_POOL],
    selected_item_list: selected,
    slots: mod.slots.map((s) => ({
      ...s,
      item_label: mapLegacySizeLabel(s.item_label),
    })),
  });
  const display = resolveModuleDisplaySlots(synced);
  return {
    ...synced,
    slots: display.map((s, index) =>
      isDetailPageSuiteSizeChartDataLabel(s.item_label)
        ? buildProgrammaticSizeChartSlot(s.item_label, index, s)
        : s,
    ),
  };
}

export function migrateDetailPageSuiteSuite(suite: DetailPageSuiteState): {
  suite: DetailPageSuiteState;
  changed: boolean;
} {
  let changed = false;
  const modules = suite.modules.map((mod) => {
    if (!isLegacySizeChartModule(mod)) return mod;
    changed = true;
    return migrateSizeChartModule(mod);
  });
  return { suite: { ...suite, modules }, changed };
}

export function migrateDetailPageSuiteProject(project: DetailPageSuiteProject): {
  project: DetailPageSuiteProject;
  changed: boolean;
} {
  const { suite, changed: suiteChanged } = migrateDetailPageSuiteSuite(project.suite);
  const briefBefore = project.brief ?? {};
  const brief = ensureBriefSizeChartDefaults(briefBefore);
  const briefChanged = JSON.stringify(brief) !== JSON.stringify(briefBefore);
  const changed = suiteChanged || briefChanged;
  return {
    changed,
    project: changed ? { ...project, suite, brief } : project,
  };
}
