import type {
  DetailPageSuiteModuleState,
  DetailPageSuiteSlot,
} from "@/lib/detail-page-suite-types";

function slotKeyForIndex(index: number, label: string): string {
  const slug = label
    .trim()
    .slice(0, 24)
    .replace(/\s+/g, "_")
    .replace(/[^\w\u4e00-\u9fff-]/g, "");
  return slug ? `item_${slug}` : `item_${index + 1}`;
}

/** 将 selected_item_list 与已有 slots 合并，供中栏点位格展示（含未生成 prompt 的占位） */
export function resolveModuleDisplaySlots(mod: DetailPageSuiteModuleState): DetailPageSuiteSlot[] {
  if (!mod.enable) return [];

  const selected = mod.selected_item_list.slice(0, Math.max(mod.generate_count, 0));
  if (selected.length === 0) return mod.slots;

  return selected.map((label, index) => {
    const byLabel = mod.slots.find((s) => s.item_label === label);
    if (byLabel) return byLabel;

    const byIndex = mod.slots[index];
    if (byIndex && !selected.includes(byIndex.item_label)) {
      return {
        ...byIndex,
        item_label: label,
      };
    }
    if (byIndex?.item_label === label) return byIndex;

    return {
      item_key: slotKeyForIndex(index, label),
      item_label: label,
      source: "template" as const,
      positive_prompt: "",
      selectedForImage: true,
    };
  });
}

/** 持久化：让 slots 与当前子维度勾选对齐（保留已有 prompt / 图片） */
export function syncModuleSlotsFromSelection(
  mod: DetailPageSuiteModuleState,
): DetailPageSuiteModuleState {
  if (!mod.enable) return { ...mod, slots: [] };
  return {
    ...mod,
    slots: resolveModuleDisplaySlots(mod),
  };
}

export function syncSuiteModulesSlots(
  modules: DetailPageSuiteModuleState[],
): DetailPageSuiteModuleState[] {
  return modules.map(syncModuleSlotsFromSelection);
}
