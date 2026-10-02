import { moduleStateFromTemplateDef } from "@/lib/ecom/detail-page-suite/module-init";
import { AI_DETAIL_PAGE_SIZE_MODULE_ID } from "@/lib/ecom/detail-page-suite/size-chart-constants";
import { AI_DETAIL_PAGE_SPEC_MODULE_ID } from "@/lib/ecom/detail-page-suite/spec-table-constants";
import {
  migrateSizeChartModule,
  migrateSpecChartModule,
} from "@/lib/ecom/detail-page-suite/suite-migrate";
import type {
  DetailPageSuiteModuleState,
  DetailPageSuiteState,
} from "@/lib/ecom/detail-page-suite/types";

import {
  AI_DETAIL_PAGE_DEFAULT_ENABLED,
  AI_DETAIL_PAGE_LEGACY_MODULE_ID_MAP,
  AI_DETAIL_PAGE_MODULE_CATALOG,
} from "./aplus-module-catalog";

function resolveExistingAplusModule(
  existingById: Map<string, DetailPageSuiteModuleState>,
  catalogId: string,
): DetailPageSuiteModuleState | undefined {
  const direct = existingById.get(catalogId);
  if (direct) return direct;
  for (const [legacyId, nextId] of Object.entries(AI_DETAIL_PAGE_LEGACY_MODULE_ID_MAP)) {
    if (nextId === catalogId) {
      const legacy = existingById.get(legacyId);
      if (legacy) return { ...legacy, module_id: catalogId };
    }
  }
  return undefined;
}

function mergeModuleWithCatalogDef(
  def: (typeof AI_DETAIL_PAGE_MODULE_CATALOG)[number],
  existing: DetailPageSuiteModuleState | undefined,
): DetailPageSuiteModuleState {
  const base = moduleStateFromTemplateDef(def);
  if (!existing) {
    const enabled = AI_DETAIL_PAGE_DEFAULT_ENABLED.has(def.module_id);
    const generate_count = enabled ? Math.min(1, def.max_num) : 0;
    const selected = enabled ? base.candidate_pool.slice(0, generate_count) : [];
    return {
      ...base,
      enable: enabled || def.required,
      generate_count: def.required ? Math.max(1, generate_count) : generate_count,
      selected_item_list: selected,
      slots: [],
    };
  }
  const generate_count = Math.min(
    Math.max(0, existing.generate_count),
    def.max_num,
  );
  let selected = existing.selected_item_list.slice(0, generate_count);
  if (selected.length < generate_count) {
    const extra = base.candidate_pool.filter((x) => !selected.includes(x));
    selected = [...selected, ...extra].slice(0, generate_count);
  }
  return {
    ...base,
    enable: existing.enable || def.required,
    generate_count: def.required && generate_count < 1 ? 1 : generate_count,
    selected_item_list: selected,
    slots: existing.slots,
  };
}

/** 将 suite.modules 对齐为完整 16 模块 catalog（保留已有 enable/点位/历史） */
export function ensureAplusSuiteMatchesCatalog(suite: DetailPageSuiteState): {
  suite: DetailPageSuiteState;
  changed: boolean;
} {
  const existingById = new Map(suite.modules.map((m) => [m.module_id, m]));
  const modules = AI_DETAIL_PAGE_MODULE_CATALOG.map((def) => {
    let merged = mergeModuleWithCatalogDef(
      def,
      resolveExistingAplusModule(existingById, def.module_id),
    );
    if (def.module_id === AI_DETAIL_PAGE_SIZE_MODULE_ID) {
      merged = migrateSizeChartModule(merged);
    }
    if (def.module_id === AI_DETAIL_PAGE_SPEC_MODULE_ID) {
      merged = migrateSpecChartModule(merged);
    }
    return merged;
  });
  const sig = (list: DetailPageSuiteModuleState[]) =>
    JSON.stringify(list.map((m) => ({ id: m.module_id, name: m.module_name })));
  const changed = modules.length !== suite.modules.length || sig(modules) !== sig(suite.modules);
  return { suite: { ...suite, modules }, changed };
}

export function buildInitialAplusSuite(): DetailPageSuiteState {
  return ensureAplusSuiteMatchesCatalog({ modules: [] }).suite;
}
