import { randomUUID } from "crypto";

import type {
  DetailPageSuiteModuleState,
  DetailPageSuiteSlot,
  DetailPageSuiteState,
} from "@/lib/ecom/detail-page-suite/types";
import { ensureDetailPageSuiteSizeChartModuleAtEnd } from "@/lib/ecom/detail-page-suite/ensure-size-chart-module-at-end";
import { ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX } from "@/lib/ecom/detail-page-suite/types";

import {
  HIT_COMPONENT_LABELS,
  maxRepeatForType,
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
  const maxNum = maxRepeatForType(comp.type);
  const count = Math.min(maxNum, Math.max(1, comp.repeat_count));
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
  let modules = template.component_list.map((c) => moduleFromComponent(c, prev.get(c.id)));
  let total = modules.filter((m) => m.enable).reduce((n, m) => n + m.generate_count, 0);
  if (total > ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX) {
    modules = modules.map((m) => {
      if (total <= ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX || !m.enable || m.generate_count <= 1) {
        return m;
      }
      const cut = Math.min(m.generate_count - 1, total - ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX);
      total -= cut;
      const generate_count = m.generate_count - cut;
      return {
        ...m,
        generate_count,
        slots: m.slots.slice(0, generate_count),
        selected_item_list: m.selected_item_list.slice(0, generate_count),
        candidate_pool: m.candidate_pool.slice(0, generate_count),
      };
    });
  }
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
        ...(slot_copy ? { slot_copy } : {}),
        positive_prompt: item.positive_prompt.trim(),
        negative_prompt: item.negative_prompt?.trim() || slot.negative_prompt,
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
