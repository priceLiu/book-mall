/**
 * 与 book-mall/lib/ecom/detail-page-suite/suite-migrate.ts 保持同步（旧项目 mod7 升级）
 */
import {
  resolveModuleDisplaySlots,
  syncModuleSlotsFromSelection,
} from "@/lib/detail-page-suite-module-slots";
import {
  DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL,
  DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER,
  isDetailPageSuiteSizeChartDataLabel,
} from "@/lib/detail-page-suite-size-chart";
import type {
  DetailPageSuiteModuleState,
  DetailPageSuiteProject,
  DetailPageSuiteState,
} from "@/lib/detail-page-suite-types";

const SIZE_MODULE_ID = "mod7_size_table";
const SIZE_MAX = 6;
const POOL = [
  "尺码数据总表图",
  "服装测量部位线稿示意图",
  "多身高模特上身试穿参考图",
] as const;

function isLegacyLabel(label: string): boolean {
  const t = label.trim();
  if (t === DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL) return false;
  return t.includes("尺码表空白") || t.includes("空白底图");
}

function mapLabel(label: string): string {
  return isLegacyLabel(label) ? DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL : label.trim();
}

function isLegacyMod(mod: DetailPageSuiteModuleState): boolean {
  if (mod.module_id !== SIZE_MODULE_ID) return false;
  if (mod.max_num < SIZE_MAX) return true;
  if (mod.module_name.trim() === "尺码表") return true;
  return mod.candidate_pool.some((p) => isLegacyLabel(p));
}

function migrateMod(mod: DetailPageSuiteModuleState): DetailPageSuiteModuleState {
  const generate_count = Math.min(Math.max(mod.generate_count || 1, 1), SIZE_MAX);
  let selected = mod.selected_item_list.map(mapLabel).slice(0, generate_count);
  if (selected.length === 0) selected = [DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL];

  const synced = syncModuleSlotsFromSelection({
    ...mod,
    module_name: "尺码参考模块",
    max_num: SIZE_MAX,
    generate_count,
    candidate_pool: [...POOL],
    selected_item_list: selected,
    slots: mod.slots.map((s) => ({ ...s, item_label: mapLabel(s.item_label) })),
  });
  const display = resolveModuleDisplaySlots(synced);
  return {
    ...synced,
    slots: display.map((s) =>
      isDetailPageSuiteSizeChartDataLabel(s.item_label)
        ? {
            ...s,
            positive_prompt: DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER,
            promptEdited: false,
          }
        : s,
    ),
  };
}

export function migrateDetailPageSuiteProjectClient(
  project: DetailPageSuiteProject,
): DetailPageSuiteProject {
  let changed = false;
  const modules = project.suite.modules.map((mod) => {
    if (!isLegacyMod(mod)) return mod;
    changed = true;
    return migrateMod(mod);
  });
  if (!changed) return project;
  return { ...project, suite: { ...project.suite, modules } };
}

export function migrateDetailPageSuiteSuiteClient(
  suite: DetailPageSuiteState,
): DetailPageSuiteState {
  return migrateDetailPageSuiteProjectClient({
    id: "",
    title: null,
    module: "detail-page-suite",
    status: "draft",
    brief: null,
    settings: {},
    references: [],
    chatHistory: [],
    suite,
    meta: null,
    createdAt: "",
    updatedAt: "",
  }).suite;
}
