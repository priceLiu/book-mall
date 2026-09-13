import { resolveModuleDisplaySlots } from "@/lib/detail-page-suite-module-slots";
import type {
  DetailPageSuiteModuleState,
  DetailPageSuiteProject,
  DetailPageSuiteSlot,
} from "@/lib/detail-page-suite-types";

export function composeSuiteSlotKey(moduleId: string, slotKey: string): string {
  return `${moduleId}::${slotKey}`;
}

export function parseSuiteSlotKey(key: string): { moduleId: string; slotKey: string } | null {
  const idx = key.indexOf("::");
  if (idx <= 0) return null;
  return { moduleId: key.slice(0, idx), slotKey: key.slice(idx + 2) };
}

export function isSuiteSlotSelectable(slot: DetailPageSuiteSlot): boolean {
  return Boolean(slot.positive_prompt?.trim());
}

export function suiteModuleSelectableSlots(mod: DetailPageSuiteModuleState): DetailPageSuiteSlot[] {
  return resolveModuleDisplaySlots(mod).filter(isSuiteSlotSelectable);
}

export type SuiteModuleSelectionState = "none" | "partial" | "all";

export function suiteModuleImageSelectionState(
  mod: DetailPageSuiteModuleState,
): SuiteModuleSelectionState {
  const selectable = suiteModuleSelectableSlots(mod);
  if (selectable.length === 0) return "none";
  const selected = selectable.filter((s) => s.selectedForImage !== false);
  if (selected.length === 0) return "none";
  if (selected.length === selectable.length) return "all";
  return "partial";
}

export function toggleSuiteModuleImageSelection(
  mod: DetailPageSuiteModuleState,
  selected: boolean,
): DetailPageSuiteModuleState {
  const slots = resolveModuleDisplaySlots(mod).map((s) =>
    isSuiteSlotSelectable(s) ? { ...s, selectedForImage: selected } : s,
  );
  return { ...mod, slots };
}

export function toggleSuiteSlotImageSelection(
  mod: DetailPageSuiteModuleState,
  slotKey: string,
): DetailPageSuiteModuleState {
  const slots = resolveModuleDisplaySlots(mod).map((s) =>
    s.item_key === slotKey && isSuiteSlotSelectable(s)
      ? { ...s, selectedForImage: s.selectedForImage === false }
      : s,
  );
  return { ...mod, slots };
}

export function listSelectedSuiteSlotKeys(project: DetailPageSuiteProject): string[] {
  const keys: string[] = [];
  for (const mod of project.suite.modules) {
    if (!mod.enable) continue;
    for (const slot of resolveModuleDisplaySlots(mod)) {
      if (!isSuiteSlotSelectable(slot)) continue;
      if (slot.selectedForImage === false) continue;
      keys.push(composeSuiteSlotKey(mod.module_id, slot.item_key));
    }
  }
  return keys;
}

export function ensureSlotsDefaultSelected(
  slots: DetailPageSuiteSlot[],
): DetailPageSuiteSlot[] {
  return slots.map((s) =>
    isSuiteSlotSelectable(s) && s.selectedForImage === undefined
      ? { ...s, selectedForImage: true }
      : s,
  );
}
