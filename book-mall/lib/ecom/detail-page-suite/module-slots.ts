import type { DetailPageSuitePromptSnapshot } from "./types";
import type { DetailPageSuiteModuleState, DetailPageSuiteSlot } from "./types";

/** 子维度 label 模糊匹配（与 prompt-llm 校验一致） */
export function detailPageSuiteLabelMatches(a: string, b: string): boolean {
  const sa = a.trim();
  const sb = b.trim();
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  const shorter = sa.length <= sb.length ? sa : sb;
  const longer = sa.length > sb.length ? sa : sb;
  // 仅当较短串是较长串的前缀时才视为同一子维度（如「首屏」↔「首屏模特…」）
  // 禁止「前 N 字相同」或双向 includes，避免「底图1 / 底图2」等同前缀条目被合并
  return shorter.length >= 2 && longer.startsWith(shorter);
}

function slotKeyForIndex(index: number, label: string): string {
  const slug = label
    .trim()
    .slice(0, 24)
    .replace(/\s+/g, "_")
    .replace(/[^\w\u4e00-\u9fff-]/g, "");
  return slug ? `item_${slug}` : `item_${index + 1}`;
}

/** 与 e-commerce-toolkit `resolveModuleDisplaySlots` 保持一致：selected_item_list 与 slots 合并 */
export function resolveModuleDisplaySlots(
  mod: DetailPageSuiteModuleState,
): DetailPageSuiteSlot[] {
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
  snapshots: Record<string, DetailPageSuitePromptSnapshot>,
  moduleId: string,
  slot: DetailPageSuiteSlot,
): DetailPageSuitePromptSnapshot | undefined {
  const byKey = snapshots[`${moduleId}::${slot.item_key}`];
  if (byKey?.prompt?.trim()) return byKey;
  for (const [key, snap] of Object.entries(snapshots)) {
    if (!key.startsWith(`${moduleId}::`)) continue;
    if (!snap.prompt?.trim()) continue;
    if (detailPageSuiteLabelMatches(snap.itemLabel, slot.item_label)) return snap;
  }
  return undefined;
}

/**
 * 将 display / 孤儿 slot / meta 快照合并为应持久化的 slots 数组。
 * 出图前、写库前调用，避免 prompt 因 selected_item_list 失步而丢失。
 */
export function materializeModuleSlots(
  mod: DetailPageSuiteModuleState,
  snapshots: Record<string, DetailPageSuitePromptSnapshot> = {},
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
