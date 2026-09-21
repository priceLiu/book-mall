import { randomUUID } from "crypto";

import { OUTDOOR_JACKET_MODULES } from "@/lib/ecom/detail-page-suite/category-seeds";
import { moduleStateFromTemplateDef } from "@/lib/ecom/detail-page-suite/module-init";
import {
  DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL,
  DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER,
  DETAIL_PAGE_SUITE_SIZE_MODULE_ID,
} from "@/lib/ecom/detail-page-suite/size-chart-constants";
import { ensureDetailPageSuiteSizeChartModuleAtEnd } from "@/lib/ecom/detail-page-suite/ensure-size-chart-module-at-end";
import { ensureBriefSizeChartDefaults } from "@/lib/ecom/detail-page-suite/size-chart-image";
import type {
  DetailPageSuiteBrief,
  DetailPageSuiteModuleState,
  DetailPageSuiteProject,
  DetailPageSuiteSlot,
  DetailPageSuiteState,
} from "@/lib/ecom/detail-page-suite/types";

import type { ReplicaPhaseA, ReplicaPhaseBModule } from "./replica-schemas";
import { REPLICA_MODULE_IDS } from "./replica-schemas";

/** 未拆解过的旧项目：12 模块全开、无 slots → 收束为「拆解前」空状态 */
export function healIdleReplicaProjectBeforeDecompose(
  project: DetailPageSuiteProject,
): DetailPageSuiteProject {
  if (project.meta?.replicaPhaseA) return project;
  const status = project.meta?.replicaStatus;
  if (status && status !== "idle") return project;
  const looksLikePlaceholderTemplate = project.suite.modules.every(
    (m) => m.enable && m.generate_count > 0 && m.slots.length === 0,
  );
  const looksLikeLegacyDisabledShell = project.suite.modules.every(
    (m) => !m.enable && m.generate_count === 0,
  );
  if (!looksLikePlaceholderTemplate && !looksLikeLegacyDisabledShell) return project;
  return { ...project, suite: buildInitialReplicaSuite() };
}

export function buildInitialReplicaSuite(): DetailPageSuiteState {
  return {
    modules: OUTDOOR_JACKET_MODULES.map((m) => moduleStateFromTemplateDef(m)),
    templateSnapshot: null,
  };
}

function maxNumForModule(moduleId: string): number {
  return OUTDOOR_JACKET_MODULES.find((m) => m.module_id === moduleId)?.max_num ?? 1;
}

function slotFromPolishItem(item: ReplicaPhaseBModule["items"][number]): DetailPageSuiteSlot {
  const isSizeChartData =
    item.item_label === DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL ||
    item.item_label.startsWith("尺码数据总表");
  return {
    item_key: item.item_key.trim() || randomUUID().slice(0, 8),
    item_label: item.item_label.trim(),
    source: "template",
    positive_prompt: isSizeChartData
      ? DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER
      : item.positive_prompt.trim(),
    negative_prompt: item.negative_prompt?.trim() || undefined,
    selectedForImage: false,
  };
}

export function applyReplicaPolishToSuite(opts: {
  suite: DetailPageSuiteState;
  phaseA: ReplicaPhaseA;
  polishByModule: Map<string, ReplicaPhaseBModule>;
  brief: DetailPageSuiteBrief | null;
  /** 仅更新这些模块；未列出的模块保持 suite 原状 */
  targetModuleIds?: string[];
}): { suite: DetailPageSuiteState; brief: DetailPageSuiteBrief | null; warning?: string } {
  const warnings: string[] = [];
  const moduleMap = new Map(opts.phaseA.modules.map((m) => [m.module_id, m]));
  let brief = opts.brief;
  const patchSet =
    opts.targetModuleIds && opts.targetModuleIds.length > 0
      ? new Set(opts.targetModuleIds)
      : null;

  const modules: DetailPageSuiteModuleState[] = REPLICA_MODULE_IDS.map((moduleId) => {
    const seed = OUTDOOR_JACKET_MODULES.find((m) => m.module_id === moduleId)!;
    const existing =
      opts.suite.modules.find((m) => m.module_id === moduleId) ??
      moduleStateFromTemplateDef(seed);

    if (patchSet && !patchSet.has(moduleId)) {
      return existing;
    }
    const aMod = moduleMap.get(moduleId);
    const polish = opts.polishByModule.get(moduleId);
    const maxNum = maxNumForModule(moduleId);

    let slots: DetailPageSuiteSlot[] = [];
    if (polish?.items.length) {
      slots = polish.items.slice(0, maxNum).map(slotFromPolishItem);
      if (polish.items.length > maxNum) {
        warnings.push(`${moduleId} 润色条数超出 max_num，已截断`);
      }
    }

    let selected_item_list = [...seed.candidate_pool].slice(0, existing.generate_count);
    let generate_count = 0;
    let enable = false;

    if (moduleId === DETAIL_PAGE_SUITE_SIZE_MODULE_ID) {
      const hasSize =
        Boolean(aMod?.sizeChartHint?.trim()) ||
        aMod?.detected === true ||
        slots.some((s) => s.item_label.includes("尺码"));
      if (hasSize) {
        enable = true;
        generate_count = 1;
        selected_item_list = [DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL];
        if (slots.length === 0) {
          slots = [
            {
              item_key: "size_chart_data",
              item_label: DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL,
              source: "template",
              positive_prompt: DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER,
              selectedForImage: false,
            },
          ];
        }
        brief = ensureBriefSizeChartDefaults(brief);
      }
    } else if (slots.length > 0) {
      enable = true;
      generate_count = slots.length;
      selected_item_list = slots.map((s) => s.item_label);
    } else if (aMod?.detected === true) {
      enable = true;
      const templ = moduleStateFromTemplateDef(seed);
      if (aMod.items.length > 0) {
        generate_count = Math.min(maxNum, aMod.items.length);
        selected_item_list = aMod.items.slice(0, generate_count).map((it) => it.item_label);
      } else if (existing.generate_count > 0 && existing.selected_item_list.length > 0) {
        generate_count = existing.generate_count;
        selected_item_list = existing.selected_item_list;
      } else {
        generate_count = templ.generate_count;
        selected_item_list = templ.selected_item_list;
      }
    }

    return {
      ...existing,
      module_id: moduleId,
      module_name: seed.module_name,
      enable,
      generate_count,
      max_num: maxNum,
      candidate_pool: seed.candidate_pool,
      selected_item_list,
      slots,
    };
  });

  const withSize = ensureDetailPageSuiteSizeChartModuleAtEnd({
    ...opts.suite,
    modules,
  });
  return {
    suite: withSize.suite,
    brief,
    warning: warnings.length ? warnings.join("；") : undefined,
  };
}
