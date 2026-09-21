import { resolveModuleDisplaySlots } from "@/lib/detail-page-suite-module-slots";
import { detailPageSuiteSlotHasImage } from "@/lib/detail-page-suite-slot-images";
import { listDetailPageSuitePendingImageKeys } from "@/lib/detail-page-suite-pending";
import {
  composeSuiteSlotKey,
  parseSuiteSlotKey,
} from "@/lib/detail-page-suite-slot-selection";
import type {
  DetailPageSuiteModuleState,
  DetailPageSuiteProject,
} from "@/lib/detail-page-suite-types";

export type DetailPageSuitePromptGenTarget = {
  key: string;
  moduleId: string;
  slotKey: string;
  moduleName: string;
  label: string;
  hasPrompt: boolean;
};

export function listDetailPageSuitePromptGenTargets(
  project: Pick<DetailPageSuiteProject, "suite">,
): DetailPageSuitePromptGenTarget[] {
  const out: DetailPageSuitePromptGenTarget[] = [];
  for (const mod of project.suite.modules) {
    if (!mod.enable || mod.generate_count <= 0) continue;
    for (const slot of resolveModuleDisplaySlots(mod)) {
      out.push({
        key: composeSuiteSlotKey(mod.module_id, slot.item_key),
        moduleId: mod.module_id,
        slotKey: slot.item_key,
        moduleName: mod.module_name,
        label: slot.item_label,
        hasPrompt: Boolean(slot.positive_prompt?.trim()),
      });
    }
  }
  return out;
}

export function resolveDetailPageSuiteBusyPromptKeys(
  project: Pick<DetailPageSuiteProject, "suite">,
  activePromptModuleIds: ReadonlySet<string>,
  activePromptSlotKeys: ReadonlySet<string>,
): Set<string> {
  const busy = new Set<string>(activePromptSlotKeys);
  for (const mod of project.suite.modules) {
    if (!activePromptModuleIds.has(mod.module_id)) continue;
    for (const slot of resolveModuleDisplaySlots(mod)) {
      busy.add(composeSuiteSlotKey(mod.module_id, slot.item_key));
    }
  }
  return busy;
}

/** 进行中点位（撰写/重写提示词、出图）不参与勾选计数与按钮数量 */
export function resolveDetailPageSuiteBusySlotKeys(
  project: Pick<DetailPageSuiteProject, "suite">,
  activePromptModuleIds: ReadonlySet<string>,
  activePromptSlotKeys: ReadonlySet<string>,
  activeGenSlotKeys: ReadonlySet<string>,
  activeRewriteSlotKeys: ReadonlySet<string>,
): Set<string> {
  const busy = resolveDetailPageSuiteBusyPromptKeys(
    project,
    activePromptModuleIds,
    activePromptSlotKeys,
  );
  for (const key of activeGenSlotKeys) busy.add(key);
  for (const key of activeRewriteSlotKeys) busy.add(key);
  return busy;
}

export function countDetailPageSuitePromptSelection(
  targets: readonly DetailPageSuitePromptGenTarget[],
  selected: ReadonlySet<string>,
  opts?: { excludeKeys?: ReadonlySet<string> },
): number {
  const exclude = opts?.excludeKeys;
  return targets.filter((t) => selected.has(t.key) && !exclude?.has(t.key)).length;
}

/** 去掉已关闭模块 / 已删点位的 stale key */
export function pruneDetailPageSuitePromptSelection(
  project: Pick<DetailPageSuiteProject, "suite">,
  selected: ReadonlySet<string>,
): Set<string> {
  const valid = new Set(listDetailPageSuitePromptGenTargets(project).map((t) => t.key));
  const next = new Set<string>();
  for (const key of selected) {
    if (valid.has(key)) next.add(key);
  }
  return next;
}

export function detailPageSuitePromptSelectionState(
  targets: readonly DetailPageSuitePromptGenTarget[],
  selected: ReadonlySet<string>,
  opts?: { excludeKeys?: ReadonlySet<string> },
): "none" | "partial" | "all" {
  const exclude = opts?.excludeKeys;
  const actionable = targets.filter((t) => !exclude?.has(t.key));
  const count = countDetailPageSuitePromptSelection(actionable, selected);
  if (actionable.length === 0 || count === 0) return "none";
  if (count >= actionable.length) return "all";
  return "partial";
}

export function modulePromptSelectionState(
  mod: DetailPageSuiteProject["suite"]["modules"][number],
  selected: ReadonlySet<string>,
  opts?: { excludeKeys?: ReadonlySet<string> },
): "none" | "partial" | "all" {
  if (!mod.enable || mod.generate_count <= 0) return "none";
  const exclude = opts?.excludeKeys;
  const keys = listModuleSlotKeys(mod).filter((k) => !exclude?.has(k));
  if (keys.length === 0) return "none";
  const hit = keys.filter((k) => selected.has(k)).length;
  if (hit === 0) return "none";
  if (hit >= keys.length) return "all";
  return "partial";
}

export function listModuleSlotKeys(mod: DetailPageSuiteModuleState): string[] {
  if (!mod.enable || mod.generate_count <= 0) return [];
  return resolveModuleDisplaySlots(mod).map((s) =>
    composeSuiteSlotKey(mod.module_id, s.item_key),
  );
}

export function moduleHasGeneratedImage(mod: DetailPageSuiteModuleState): boolean {
  return resolveModuleDisplaySlots(mod).some((s) => detailPageSuiteSlotHasImage(s));
}

export function countModuleSlotSelection(
  mod: DetailPageSuiteModuleState,
  selected: ReadonlySet<string>,
  opts?: {
    excludeKeys?: ReadonlySet<string>;
    requirePrompt?: boolean;
    requireNoPrompt?: boolean;
  },
): number {
  const exclude = opts?.excludeKeys;
  let n = 0;
  for (const slot of resolveModuleDisplaySlots(mod)) {
    const key = composeSuiteSlotKey(mod.module_id, slot.item_key);
    if (!selected.has(key) || exclude?.has(key)) continue;
    const hasPrompt = Boolean(slot.positive_prompt?.trim());
    if (opts?.requirePrompt && !hasPrompt) continue;
    if (opts?.requireNoPrompt && hasPrompt) continue;
    n++;
  }
  return n;
}

export function detailPageSuiteProjectSlotHasImage(
  project: Pick<DetailPageSuiteProject, "suite">,
  compositeKey: string,
): boolean {
  const parsed = parseSuiteSlotKey(compositeKey);
  if (!parsed) return false;
  const mod = project.suite.modules.find((m) => m.module_id === parsed.moduleId);
  const slot = mod
    ? resolveModuleDisplaySlots(mod).find((s) => s.item_key === parsed.slotKey)
    : undefined;
  return Boolean(slot?.imageUrl?.trim());
}

/** 已在出图中（客户端 activeGen + meta.pendingImages 且无成图）的点位，不再重复提交 */
export function resolveDetailPageSuiteBusyImageGenExcludeKeys(
  project: Pick<DetailPageSuiteProject, "suite" | "meta">,
  activeGenSlotKeys: ReadonlySet<string>,
): Set<string> {
  const busy = new Set<string>(activeGenSlotKeys);
  for (const key of listDetailPageSuitePendingImageKeys(project.meta)) {
    if (!detailPageSuiteProjectSlotHasImage(project, key)) busy.add(key);
  }
  return busy;
}

/** 本次出图 API / 出图中 UI 仅应包含的 composite slotKeys（与「生图(N)」计数一致） */
export function resolveDetailPageSuiteImageGenSlotKeys(
  project: Pick<DetailPageSuiteProject, "suite">,
  selected: ReadonlySet<string>,
  opts?: { moduleId?: string; excludeKeys?: ReadonlySet<string> },
): string[] {
  const modules = opts?.moduleId
    ? project.suite.modules.filter((m) => m.module_id === opts.moduleId)
    : project.suite.modules;
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const mod of modules) {
    for (const k of listModuleSelectedSlotKeys(mod, selected, {
      requirePrompt: true,
      excludeKeys: opts?.excludeKeys,
    })) {
      if (seen.has(k)) continue;
      seen.add(k);
      keys.push(k);
    }
  }
  return keys;
}

export function listModuleSelectedSlotKeys(
  mod: DetailPageSuiteModuleState,
  selected: ReadonlySet<string>,
  opts?: {
    excludeKeys?: ReadonlySet<string>;
    requirePrompt?: boolean;
    requireNoPrompt?: boolean;
  },
): string[] {
  const exclude = opts?.excludeKeys;
  const keys: string[] = [];
  for (const slot of resolveModuleDisplaySlots(mod)) {
    const key = composeSuiteSlotKey(mod.module_id, slot.item_key);
    if (!selected.has(key) || exclude?.has(key)) continue;
    const hasPrompt = Boolean(slot.positive_prompt?.trim());
    if (opts?.requirePrompt && !hasPrompt) continue;
    if (opts?.requireNoPrompt && hasPrompt) continue;
    keys.push(key);
  }
  return keys;
}
