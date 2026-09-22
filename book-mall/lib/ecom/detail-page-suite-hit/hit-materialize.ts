import { randomUUID } from "crypto";

import type {
  DetailPageSuiteModuleState,
  DetailPageSuiteSlot,
  DetailPageSuiteState,
} from "@/lib/ecom/detail-page-suite/types";
import { ensureDetailPageSuiteSizeChartModuleAtEnd } from "@/lib/ecom/detail-page-suite/ensure-size-chart-module-at-end";
import { HIT_REPEAT_COUNT_MAX } from "./hit-schemas";

import {
  HIT_COMPONENT_LABELS,
  type HitComponent,
  type HitRewrite,
  type NormalizedHitTemplate,
} from "./hit-schemas";

export function buildInitialHitSuite(): DetailPageSuiteState {
  return { modules: [], templateSnapshot: null };
}

function slotLabel(comp: HitComponent, index: number): string {
  const base = HIT_COMPONENT_LABELS[comp.type];
  if (comp.repeat_count <= 1) return base;
  return `${base} ${index + 1}`;
}

function emptySlot(comp: HitComponent, index: number, existing?: DetailPageSuiteSlot): DetailPageSuiteSlot {
  return {
    item_key: existing?.item_key || `${comp.id}_${index + 1}`,
    item_label: existing?.item_label || slotLabel(comp, index),
    source: existing?.source ?? "template",
    positive_prompt: existing?.positive_prompt ?? "",
    negative_prompt: existing?.negative_prompt,
    slot_copy: existing?.slot_copy,
    slot_copy_ai: existing?.slot_copy_ai,
    burn_copy_in_image: existing?.burn_copy_in_image,
    imageUrl: existing?.imageUrl,
    assetId: existing?.assetId,
    imageHistory: existing?.imageHistory,
    activeImageIndex: existing?.activeImageIndex,
    selectedForImage: existing?.selectedForImage ?? false,
    promptEdited: existing?.promptEdited,
  };
}

function moduleFromComponent(
  comp: HitComponent,
  existing?: DetailPageSuiteModuleState,
): DetailPageSuiteModuleState {
  const maxNum = HIT_REPEAT_COUNT_MAX;
  const count = Math.min(HIT_REPEAT_COUNT_MAX, Math.max(1, comp.repeat_count));
  const prevSlots = existing?.slots ?? [];
  const slots = Array.from({ length: count }, (_, i) => emptySlot(comp, i, prevSlots[i]));
  return {
    module_id: comp.id,
    module_name: HIT_COMPONENT_LABELS[comp.type],
    enable: existing?.enable ?? true,
    generate_count: count,
    max_num: maxNum,
    select_mode: "manual",
    candidate_pool: slots.map((s) => s.item_label),
    selected_item_list: slots.map((s) => s.item_label),
    slots,
  };
}

export function materializeHitTemplateToSuite(
  template: NormalizedHitTemplate,
  existing?: DetailPageSuiteState | null,
): DetailPageSuiteState {
  const prev = new Map((existing?.modules ?? []).map((m) => [m.module_id, m]));
  const modules = template.component_list.map((c) => moduleFromComponent(c, prev.get(c.id)));
  const withSize = ensureDetailPageSuiteSizeChartModuleAtEnd({ modules, templateSnapshot: null });
  return withSize.suite;
}

export function applyHitRewriteToSuite(opts: {
  suite: DetailPageSuiteState;
  template: NormalizedHitTemplate;
  rewrite: HitRewrite;
}): { suite: DetailPageSuiteState; warning?: string } {
  const byId = new Map(opts.rewrite.components.map((c) => [c.component_id, c]));
  const warnings: string[] = [];
  const modules = opts.template.component_list.map((comp) => {
    const existing = opts.suite.modules.find((m) => m.module_id === comp.id);
    const base = moduleFromComponent(comp, existing);
    const rewritten = byId.get(comp.id);
    if (!rewritten) {
      warnings.push(`${HIT_COMPONENT_LABELS[comp.type]} 未返回重写文案`);
      return base;
    }
    const slots = base.slots.map((slot, i) => {
      const item = rewritten.items[i];
      if (!item) return slot;
      const slot_copy = item.slot_copy?.trim();
      return {
        ...slot,
        item_key: item.item_key.trim() || slot.item_key || randomUUID().slice(0, 8),
        item_label: item.item_label.trim() || slot.item_label,
        ...(slot_copy
          ? { slot_copy, slot_copy_ai: slot_copy }
          : { slot_copy: undefined, slot_copy_ai: undefined }),
        positive_prompt: item.positive_prompt.trim(),
        negative_prompt: item.negative_prompt?.trim() || slot.negative_prompt,
        burn_copy_in_image: slot.burn_copy_in_image ?? false,
        selectedForImage: false,
      };
    });
    return {
      ...base,
      candidate_pool: slots.map((s) => s.item_label),
      selected_item_list: slots.map((s) => s.item_label),
      slots,
    };
  });
  const withSize = ensureDetailPageSuiteSizeChartModuleAtEnd({
    ...opts.suite,
    modules,
  });
  return {
    suite: withSize.suite,
    warning: warnings.length ? warnings.join("；") : undefined,
  };
}
