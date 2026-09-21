import { resolveModuleDisplaySlots } from "./module-slots";
import type {
  DetailPageSuiteMeta,
  DetailPageSuiteModuleState,
  DetailPageSuiteState,
} from "./types";

export type DetailPageSuitePromptSnapshot = {
  prompt: string;
  itemLabel: string;
  updatedAt: string;
};

export function detailPageSuiteSlotCompositeKey(moduleId: string, slotKey: string): string {
  return `${moduleId}::${slotKey}`;
}

export function readDetailPageSuitePromptSnapshots(
  meta: unknown,
): Record<string, DetailPageSuitePromptSnapshot> {
  if (!meta || typeof meta !== "object") return {};
  const raw = (meta as DetailPageSuiteMeta).promptSnapshots;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, DetailPageSuitePromptSnapshot> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.trim() || !value || typeof value !== "object") continue;
    const entry = value as DetailPageSuitePromptSnapshot;
    const prompt = entry.prompt?.trim();
    if (!prompt) continue;
    out[key] = {
      prompt,
      itemLabel: entry.itemLabel?.trim() || key,
      updatedAt: entry.updatedAt || new Date(0).toISOString(),
    };
  }
  return out;
}

export function upsertDetailPageSuitePromptSnapshots(
  meta: DetailPageSuiteMeta | null | undefined,
  entries: Array<{
    moduleId: string;
    slotKey: string;
    itemLabel: string;
    prompt: string;
  }>,
): DetailPageSuiteMeta {
  if (entries.length === 0) return { ...(meta ?? {}) };
  const snapshots = readDetailPageSuitePromptSnapshots(meta);
  const now = new Date().toISOString();
  for (const entry of entries) {
    const prompt = entry.prompt.trim();
    if (prompt.length < 1) continue;
    const key = detailPageSuiteSlotCompositeKey(entry.moduleId, entry.slotKey);
    snapshots[key] = {
      prompt,
      itemLabel: entry.itemLabel.trim() || entry.slotKey,
      updatedAt: now,
    };
  }
  return { ...(meta ?? {}), promptSnapshots: snapshots };
}

export function collectPromptSnapshotEntriesFromModules(
  modules: DetailPageSuiteModuleState[],
): Array<{ moduleId: string; slotKey: string; itemLabel: string; prompt: string }> {
  const out: Array<{ moduleId: string; slotKey: string; itemLabel: string; prompt: string }> = [];
  for (const mod of modules) {
    for (const slot of resolveModuleDisplaySlots(mod)) {
      const prompt = slot.positive_prompt?.trim();
      if (!prompt) continue;
      out.push({
        moduleId: mod.module_id,
        slotKey: slot.item_key,
        itemLabel: slot.item_label,
        prompt,
      });
    }
  }
  return out;
}

export function upsertPromptSnapshotsFromSuite(
  meta: DetailPageSuiteMeta | null | undefined,
  suite: DetailPageSuiteState,
): DetailPageSuiteMeta | null {
  const entries = collectPromptSnapshotEntriesFromModules(suite.modules);
  if (entries.length === 0 && !readDetailPageSuitePromptSnapshots(meta)) {
    return meta ?? null;
  }
  return upsertDetailPageSuitePromptSnapshots(meta, entries);
}
