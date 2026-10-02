import { materializeModuleSlots } from "@/lib/ecom/detail-page-suite/module-slots";
import {
  isDetailPageSuiteSizeChartDataLabel,
  isDetailPageSuiteSizeChartModuleId,
} from "@/lib/ecom/detail-page-suite/size-chart-constants";
import { buildProgrammaticSizeChartSlot } from "@/lib/ecom/detail-page-suite/size-chart-prompt";
import {
  isDetailPageSuiteSpecChartDataLabel,
  isDetailPageSuiteSpecChartModuleId,
} from "@/lib/ecom/detail-page-suite/spec-table-constants";
import { buildProgrammaticSpecChartSlot } from "@/lib/ecom/detail-page-suite/spec-table-prompt";
import type { DetailPageSuiteModuleState } from "@/lib/ecom/detail-page-suite/types";

export function fillSelectedItemsForModule(mod: DetailPageSuiteModuleState): string[] {
  let selected = mod.selected_item_list.slice(0, mod.generate_count);
  if (selected.length < mod.generate_count) {
    const extra = mod.candidate_pool.filter((x) => !selected.includes(x));
    selected = [...selected, ...extra].slice(0, mod.generate_count);
  }
  return selected;
}

export function materializeAplusModuleSlots(m: DetailPageSuiteModuleState): DetailPageSuiteModuleState {
  if (!m.enable || m.generate_count < 1) return m;
  const selected = fillSelectedItemsForModule(m);
  if (selected.length !== m.generate_count) {
    throw new Error(`${m.module_name} 请先选满 ${m.generate_count} 个子维度`);
  }
  const withSelection = { ...m, selected_item_list: selected };
  const prevByKey = new Map(m.slots.map((s) => [s.item_key, s]));
  const materialized = materializeModuleSlots(withSelection);
  let slots = materialized.map((slot) => {
    const prev = prevByKey.get(slot.item_key);
    if (!prev) return { ...slot, positive_prompt: "" };
    return {
      ...slot,
      positive_prompt: prev.promptEdited ? prev.positive_prompt : "",
      promptEdited: prev.promptEdited,
      imageUrl: prev.imageUrl,
      imageHistory: prev.imageHistory,
      activeImageIndex: prev.activeImageIndex,
      assetId: prev.assetId,
      selectedForImage: prev.selectedForImage,
      promptRefUrls: prev.promptRefUrls,
      promptRefNote: prev.promptRefNote,
    };
  });
  if (isDetailPageSuiteSizeChartModuleId(m.module_id)) {
    slots = slots.map((slot, index) =>
      isDetailPageSuiteSizeChartDataLabel(slot.item_label)
        ? buildProgrammaticSizeChartSlot(slot.item_label, index, slot)
        : slot,
    );
  }
  if (isDetailPageSuiteSpecChartModuleId(m.module_id)) {
    slots = slots.map((slot, index) =>
      isDetailPageSuiteSpecChartDataLabel(slot.item_label)
        ? buildProgrammaticSpecChartSlot(slot.item_label, index, slot)
        : slot,
    );
  }
  return { ...withSelection, slots };
}
