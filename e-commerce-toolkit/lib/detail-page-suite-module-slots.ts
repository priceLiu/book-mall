import type {
  DetailPageSuiteModuleState,
  DetailPageSuiteSlot,
} from "@/lib/detail-page-suite-types";

import { DETAIL_PAGE_SUITE_SIZE_MODULE_ID } from "@/lib/detail-page-suite-add-custom-slot";

type PromptSnapshot = { prompt: string; itemLabel: string; updatedAt: string };

export function detailPageSuiteLabelMatches(a: string, b: string): boolean {
  const sa = a.trim();
  const sb = b.trim();
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  const shorter = sa.length <= sb.length ? sa : sb;
  const longer = sa.length > sb.length ? sa : sb;
  return shorter.length >= 2 && longer.startsWith(shorter);
}

export function defaultDetailPageSuiteGenerateCount(moduleId: string, maxNum: number): number {
  if (moduleId === DETAIL_PAGE_SUITE_SIZE_MODULE_ID) return Math.min(1, maxNum);
  return maxNum;
}

/** 复刻：与详情页套图一致，按模板 N 展示占位格（待生成提示词） */
export function moduleStateForReplicaPlaceholderGrid(
  mod: DetailPageSuiteModuleState,
): DetailPageSuiteModuleState {
  const generate_count =
    mod.generate_count > 0
      ? mod.generate_count
      : defaultDetailPageSuiteGenerateCount(mod.module_id, mod.max_num);
  const pool = mod.candidate_pool ?? [];
  const selected =
    mod.selected_item_list.length > 0
      ? mod.selected_item_list.slice(0, generate_count)
      : pool.slice(0, generate_count);
  return {
    ...mod,
    enable: true,
    generate_count,
    selected_item_list: selected,
  };
}

export function resolveReplicaModuleDisplaySlots(
  mod: DetailPageSuiteModuleState,
): DetailPageSuiteSlot[] {
  return resolveModuleDisplaySlots(moduleStateForReplicaPlaceholderGrid(mod));
}

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

  const consumedKeys = new Set<string>();

  return selected.map((label, index) => {
    const byExactLabel = mod.slots.find(
      (s) => !consumedKeys.has(s.item_key) && s.item_label.trim() === label.trim(),
    );
    if (byExactLabel) {
      consumedKeys.add(byExactLabel.item_key);
      return byExactLabel;
    }

    const byLabel = mod.slots.find(
      (s) => !consumedKeys.has(s.item_key) && detailPageSuiteLabelMatches(s.item_label, label),
    );
    if (byLabel) {
      consumedKeys.add(byLabel.item_key);
      return byLabel;
    }

    const byIndex = mod.slots[index];
    if (byIndex && !consumedKeys.has(byIndex.item_key) && !selected.includes(byIndex.item_label)) {
      consumedKeys.add(byIndex.item_key);
      return {
        ...byIndex,
        item_label: label,
      };
    }
    if (byIndex && !consumedKeys.has(byIndex.item_key) && byIndex.item_label === label) {
      consumedKeys.add(byIndex.item_key);
      return byIndex;
    }

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
    slots: materializeModuleSlots(mod),
  };
}

function findPromptSnapshotForSlot(
  snapshots: Record<string, PromptSnapshot>,
  moduleId: string,
  slot: DetailPageSuiteSlot,
): PromptSnapshot | undefined {
  const byKey = snapshots[`${moduleId}::${slot.item_key}`];
  if (byKey?.prompt?.trim()) return byKey;
  for (const [key, snap] of Object.entries(snapshots)) {
    if (!key.startsWith(`${moduleId}::`)) continue;
    if (!snap.prompt?.trim()) continue;
    if (detailPageSuiteLabelMatches(snap.itemLabel, slot.item_label)) return snap;
  }
  return undefined;
}

export function materializeModuleSlots(
  mod: DetailPageSuiteModuleState,
  snapshots: Record<string, PromptSnapshot> = {},
): DetailPageSuiteSlot[] {
  const applySnapshots = (slot: DetailPageSuiteSlot): DetailPageSuiteSlot => {
    if (slot.positive_prompt?.trim()) return slot;
    const backup = findPromptSnapshotForSlot(snapshots, mod.module_id, slot);
    if (!backup?.prompt?.trim()) return slot;
    return { ...slot, positive_prompt: backup.prompt.trim() };
  };

  const baseSlots = mod.slots.map(applySnapshots);
  const modWithSnap: DetailPageSuiteModuleState = { ...mod, slots: baseSlots };
  const display = resolveModuleDisplaySlots(modWithSnap).map(applySnapshots);
  const consumedKeys = new Set<string>();

  const filled = display.map((slot, index) => {
    if (slot.positive_prompt?.trim()) {
      consumedKeys.add(slot.item_key);
      return slot;
    }
    const orphan = baseSlots.find(
      (s) =>
        s.positive_prompt?.trim() &&
        !consumedKeys.has(s.item_key) &&
        (detailPageSuiteLabelMatches(s.item_label, slot.item_label) ||
          baseSlots.indexOf(s) === index),
    );
    if (!orphan) return slot;
    consumedKeys.add(orphan.item_key);
    return {
      ...slot,
      positive_prompt: orphan.positive_prompt,
      slot_copy: orphan.slot_copy?.trim() || slot.slot_copy,
      slot_copy_ai: orphan.slot_copy_ai?.trim() || slot.slot_copy_ai,
      burn_copy_in_image: orphan.burn_copy_in_image ?? slot.burn_copy_in_image,
      promptEdited: orphan.promptEdited,
      imageUrl: orphan.imageUrl ?? slot.imageUrl,
      assetId: orphan.assetId ?? slot.assetId,
      imageHistory: orphan.imageHistory ?? slot.imageHistory,
      activeImageIndex: orphan.activeImageIndex ?? slot.activeImageIndex,
      source: orphan.source ?? slot.source,
    };
  });

  const extras = baseSlots.filter(
    (s) =>
      s.positive_prompt?.trim() &&
      !filled.some(
        (f) =>
          f.item_key === s.item_key ||
          detailPageSuiteLabelMatches(f.item_label, s.item_label),
      ),
  );

  return mergeModuleSlotsPreservingContent(baseSlots, [...filled, ...extras]);
}

export function syncSuiteModulesSlots(
  modules: DetailPageSuiteModuleState[],
): DetailPageSuiteModuleState[] {
  return modules.map(syncModuleSlotsFromSelection);
}

/** 写回 slots 时保留已有 prompt / 图片，避免 merge 丢失 */
export function mergeModuleSlotsPreservingContent(
  previous: DetailPageSuiteSlot[],
  next: DetailPageSuiteSlot[],
): DetailPageSuiteSlot[] {
  const prevByKey = new Map(previous.map((s) => [s.item_key, s]));
  const prevByLabel = new Map(previous.map((s) => [s.item_label, s]));
  return next.map((slot) => {
    const prev = prevByKey.get(slot.item_key) ?? prevByLabel.get(slot.item_label);
    if (!prev) return slot;
    return {
      ...prev,
      ...slot,
      positive_prompt: slot.positive_prompt?.trim() || prev.positive_prompt || "",
      slot_copy: slot.slot_copy?.trim() || prev.slot_copy,
      slot_copy_ai: slot.slot_copy_ai?.trim() || prev.slot_copy_ai,
      burn_copy_in_image: slot.burn_copy_in_image ?? prev.burn_copy_in_image,
      imageUrl: slot.imageUrl?.trim() || prev.imageUrl,
      assetId: slot.assetId ?? prev.assetId,
      imageHistory:
        Array.isArray(slot.imageHistory) && slot.imageHistory.length > 0
          ? slot.imageHistory
          : prev.imageHistory,
      activeImageIndex: slot.activeImageIndex ?? prev.activeImageIndex,
      selectedForImage: slot.selectedForImage ?? prev.selectedForImage,
      promptEdited: slot.promptEdited ?? prev.promptEdited,
      source: slot.source ?? prev.source,
    };
  });
}
