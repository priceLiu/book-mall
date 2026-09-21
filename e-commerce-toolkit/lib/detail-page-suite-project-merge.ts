import { materializeModuleSlots, resolveModuleDisplaySlots } from "@/lib/detail-page-suite-module-slots";
import type { DetailPageSuiteProject, DetailPageSuiteSlot } from "@/lib/detail-page-suite-types";

function slotHasPersistedImage(slot: DetailPageSuiteSlot | undefined): boolean {
  return Boolean(slot?.imageUrl?.trim()) || (slot?.imageHistory?.length ?? 0) > 0;
}

function mergeSlotImageFields(
  target: DetailPageSuiteSlot,
  source: DetailPageSuiteSlot,
): DetailPageSuiteSlot {
  if (!slotHasPersistedImage(source) || slotHasPersistedImage(target)) return target;
  return {
    ...target,
    imageUrl: source.imageUrl,
    assetId: source.assetId,
    imageHistory: source.imageHistory,
    activeImageIndex: source.activeImageIndex,
  };
}

/** 并发写回单条提示词时，只合并目标 slot，避免后完成的请求覆盖其它点位 */
export function mergeDetailPageSuiteSlotPromptFromProject(
  base: DetailPageSuiteProject,
  incoming: DetailPageSuiteProject,
  moduleId: string,
  slotKey: string,
): DetailPageSuiteProject | null {
  const inMod = incoming.suite.modules.find((m) => m.module_id === moduleId);
  if (!inMod) return null;
  const inSlot = resolveModuleDisplaySlots(inMod).find((s) => s.item_key === slotKey);
  if (!inSlot?.positive_prompt?.trim()) return null;

  const modules = base.suite.modules.map((m) => {
    if (m.module_id !== moduleId) return m;
    return {
      ...m,
      slots: materializeModuleSlots({
        ...m,
        slots: resolveModuleDisplaySlots(m).map((s) =>
          s.item_key === slotKey
            ? {
                ...s,
                positive_prompt: inSlot.positive_prompt,
                promptEdited: inSlot.promptEdited ?? false,
              }
            : s,
        ),
      }),
    };
  });

  return {
    ...base,
    suite: { ...base.suite, modules },
    meta: incoming.meta ?? base.meta,
  };
}

/** GET 响应可能略旧于刚完成的写提示词；保留本地已有 prompt，避免界面闪回「待生成」 */
export function mergeDetailPageSuiteProjectPreservingLocalPrompts(
  local: DetailPageSuiteProject,
  loaded: DetailPageSuiteProject,
): DetailPageSuiteProject {
  let merged = loaded;
  for (const mod of local.suite.modules) {
    for (const slot of resolveModuleDisplaySlots(mod)) {
      const loadedMod = merged.suite.modules.find((m) => m.module_id === mod.module_id);
      const loadedSlot = loadedMod
        ? resolveModuleDisplaySlots(loadedMod).find((s) => s.item_key === slot.item_key)
        : undefined;

      if (slot.positive_prompt?.trim() && !loadedSlot?.positive_prompt?.trim()) {
        merged =
          mergeDetailPageSuiteSlotPromptFromProject(
            merged,
            local,
            mod.module_id,
            slot.item_key,
          ) ?? merged;
      }

      if (slotHasPersistedImage(slot) && !slotHasPersistedImage(loadedSlot)) {
        const modules = merged.suite.modules.map((m) => {
          if (m.module_id !== mod.module_id) return m;
          return {
            ...m,
            slots: materializeModuleSlots({
              ...m,
              slots: resolveModuleDisplaySlots(m).map((s) =>
                s.item_key === slot.item_key ? mergeSlotImageFields(s, slot) : s,
              ),
            }),
          };
        });
        merged = { ...merged, suite: { ...merged.suite, modules } };
      }
    }
  }
  return merged;
}
