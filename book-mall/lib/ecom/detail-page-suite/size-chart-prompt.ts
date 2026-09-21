import {
  buildDetailPageSuiteBlankPlateBody,
  composeDetailPageSuiteVisiblePrompt,
  stripDetailPageSuitePromptEnvelope,
} from "./brief-context";
import { materializeModuleSlots, resolveModuleDisplaySlots } from "./module-slots";
import {
  DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER,
  isDetailPageSuiteSizeChartDataLabel,
} from "./size-chart-constants";
import { ensureBriefSizeChartDefaults } from "./size-chart-image";
import { BLANK_PLATE_MODULE_IDS } from "./types";
import type {
  DetailPageSuiteBrief,
  DetailPageSuiteModuleState,
  DetailPageSuiteSlot,
} from "./types";

export function buildProgrammaticSizeChartSlot(
  label: string,
  index: number,
  prev?: DetailPageSuiteSlot,
): DetailPageSuiteSlot {
  return {
    item_key: prev?.item_key ?? `item_size_${index + 1}`,
    item_label: label,
    source: "template",
    positive_prompt: DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER,
    imageUrl: prev?.imageUrl,
    assetId: prev?.assetId,
    imageHistory: prev?.imageHistory,
    activeImageIndex: prev?.activeImageIndex,
    selectedForImage: prev?.selectedForImage ?? true,
    promptEdited: false,
  };
}

export function partitionSizeModuleSelected(selected: string[]): {
  programmatic: string[];
  llm: string[];
} {
  const programmatic: string[] = [];
  const llm: string[] = [];
  for (const label of selected) {
    if (isDetailPageSuiteSizeChartDataLabel(label)) programmatic.push(label);
    else llm.push(label);
  }
  return { programmatic, llm };
}

export function buildModuleSlotForLabel(
  mod: DetailPageSuiteModuleState,
  label: string,
  index: number,
  brief: DetailPageSuiteBrief,
  llmItem?: { item_key?: string; positive_prompt: string },
): DetailPageSuiteSlot {
  const display = resolveModuleDisplaySlots(mod);
  const prev =
    display.find((s) => s.item_label.trim() === label.trim()) ?? display[index];
  if (isDetailPageSuiteSizeChartDataLabel(label)) {
    return buildProgrammaticSizeChartSlot(label, index, prev);
  }
  if (!llmItem?.positive_prompt?.trim()) {
    throw new Error(`「${label}」缺少提示词`);
  }
  const blankPlate = BLANK_PLATE_MODULE_IDS.has(mod.module_id);
  const llmBody = blankPlate
    ? buildDetailPageSuiteBlankPlateBody(label)
    : stripDetailPageSuitePromptEnvelope(llmItem.positive_prompt.trim());
  return {
    item_key: llmItem.item_key?.trim() || prev?.item_key || `item_${index + 1}`,
    item_label: label,
    source: "template",
    positive_prompt: composeDetailPageSuiteVisiblePrompt(
      llmBody,
      brief,
      label,
      mod.module_id,
    ),
    imageUrl: prev?.imageUrl,
    assetId: prev?.assetId,
    imageHistory: prev?.imageHistory,
    activeImageIndex: prev?.activeImageIndex,
    selectedForImage: prev?.selectedForImage ?? true,
    promptEdited: false,
  };
}

export function buildModuleSlotsForSelected(
  mod: DetailPageSuiteModuleState,
  selected: string[],
  brief: DetailPageSuiteBrief,
  llmItemsByLabel: Map<string, { item_key?: string; positive_prompt: string }>,
): DetailPageSuiteSlot[] {
  return selected.map((label, i) =>
    buildModuleSlotForLabel(mod, label, i, brief, llmItemsByLabel.get(label)),
  );
}
