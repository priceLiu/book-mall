import type { DetailPageSuiteMeta, DetailPageSuiteProject, DetailPageSuiteState } from "./types";
import { resolveModuleDisplaySlots } from "./module-slots";

export type DetailPageSuitePendingImageEntry = {
  startedAt: string;
  modelKey?: string;
};

export type DetailPageSuitePendingPromptEntry = {
  startedAt: string;
};

export type DetailPageSuitePendingImagesMap = Record<string, DetailPageSuitePendingImageEntry>;
export type DetailPageSuitePendingPromptModulesMap = Record<
  string,
  DetailPageSuitePendingPromptEntry
>;

const STALE_IMAGE_MS = 45 * 60 * 1000;
const STALE_PROMPT_MS = 15 * 60 * 1000;

function readRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

export function readDetailPageSuitePendingImages(meta: unknown): DetailPageSuitePendingImagesMap {
  const raw = readRecord((meta as DetailPageSuiteMeta | null)?.pendingImages);
  const out: DetailPageSuitePendingImagesMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.trim() || !value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const startedAt = typeof entry.startedAt === "string" ? entry.startedAt.trim() : "";
    if (!startedAt) continue;
    out[key] = {
      startedAt,
      ...(typeof entry.modelKey === "string" && entry.modelKey.trim()
        ? { modelKey: entry.modelKey.trim() }
        : {}),
    };
  }
  return out;
}

export function readDetailPageSuitePendingPromptModules(
  meta: unknown,
): DetailPageSuitePendingPromptModulesMap {
  const raw = readRecord((meta as DetailPageSuiteMeta | null)?.pendingPromptModules);
  const out: DetailPageSuitePendingPromptModulesMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.trim() || !value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const startedAt = typeof entry.startedAt === "string" ? entry.startedAt.trim() : "";
    if (!startedAt) continue;
    out[key] = { startedAt };
  }
  return out;
}

function slotHasImageAfter(mod: DetailPageSuiteProject["suite"]["modules"][number], slotKey: string, sinceIso: string): boolean {
  const slot = resolveModuleDisplaySlots(mod).find((s) => s.item_key === slotKey);
  if (!slot) return false;
  if (slot.imageUrl?.trim()) {
    const history = slot.imageHistory ?? [];
    if (history.length === 0) return true;
    return history.some((h) => h.createdAt >= sinceIso && h.url?.trim());
  }
  return false;
}

export function reconcileDetailPageSuitePendingMeta(
  suite: DetailPageSuiteState,
  meta: DetailPageSuiteMeta | null | undefined,
  now = Date.now(),
): DetailPageSuiteMeta | null {
  const base = meta ?? {};
  const pendingImages = { ...readDetailPageSuitePendingImages(base) };
  const pendingPromptModules = { ...readDetailPageSuitePendingPromptModules(base) };

  for (const [key, entry] of Object.entries(pendingImages)) {
    const idx = key.indexOf("::");
    if (idx <= 0) {
      delete pendingImages[key];
      continue;
    }
    const moduleId = key.slice(0, idx);
    const slotKey = key.slice(idx + 2);
    const mod = suite.modules.find((m) => m.module_id === moduleId);
    const stale = now - Date.parse(entry.startedAt) > STALE_IMAGE_MS;
    if (!mod || stale || slotHasImageAfter(mod, slotKey, entry.startedAt)) {
      delete pendingImages[key];
    }
  }

  for (const [moduleId, entry] of Object.entries(pendingPromptModules)) {
    const mod = suite.modules.find((m) => m.module_id === moduleId);
    const stale = now - Date.parse(entry.startedAt) > STALE_PROMPT_MS;
    if (!mod || stale) {
      delete pendingPromptModules[moduleId];
      continue;
    }
    const display = resolveModuleDisplaySlots(mod);
    const expected = Math.max(mod.generate_count, 0);
    const ready = display.filter((s) => s.positive_prompt?.trim()).length;
    if (expected > 0 && ready >= expected) {
      delete pendingPromptModules[moduleId];
    }
  }

  const next: DetailPageSuiteMeta = { ...base };
  if (Object.keys(pendingImages).length > 0) next.pendingImages = pendingImages;
  else delete next.pendingImages;
  if (Object.keys(pendingPromptModules).length > 0) next.pendingPromptModules = pendingPromptModules;
  else delete next.pendingPromptModules;
  return Object.keys(next).length > 0 ? next : null;
}

export function markDetailPageSuiteImagesPending(
  meta: DetailPageSuiteMeta | null | undefined,
  keys: string[],
  modelKey?: string,
): DetailPageSuiteMeta {
  const startedAt = new Date().toISOString();
  const pendingImages = { ...readDetailPageSuitePendingImages(meta) };
  for (const key of keys) {
    const trimmed = key.trim();
    if (!trimmed) continue;
    pendingImages[trimmed] = {
      startedAt,
      ...(modelKey?.trim() ? { modelKey: modelKey.trim() } : {}),
    };
  }
  return { ...(meta ?? {}), pendingImages };
}

export function clearDetailPageSuiteImagesPending(
  meta: DetailPageSuiteMeta | null | undefined,
  keys: string[],
): DetailPageSuiteMeta | null {
  if (!meta && keys.length === 0) return null;
  const pendingImages = { ...readDetailPageSuitePendingImages(meta) };
  for (const key of keys) {
    delete pendingImages[key.trim()];
  }
  const next: DetailPageSuiteMeta = { ...(meta ?? {}) };
  if (Object.keys(pendingImages).length > 0) next.pendingImages = pendingImages;
  else delete next.pendingImages;
  return Object.keys(next).length > 0 ? next : null;
}

export function markDetailPageSuitePromptModulePending(
  meta: DetailPageSuiteMeta | null | undefined,
  moduleId: string,
): DetailPageSuiteMeta {
  const startedAt = new Date().toISOString();
  const pendingPromptModules = {
    ...readDetailPageSuitePendingPromptModules(meta),
    [moduleId]: { startedAt },
  };
  return { ...(meta ?? {}), pendingPromptModules };
}

export function clearDetailPageSuitePromptModulePending(
  meta: DetailPageSuiteMeta | null | undefined,
  moduleId: string,
): DetailPageSuiteMeta | null {
  const pendingPromptModules = { ...readDetailPageSuitePendingPromptModules(meta) };
  delete pendingPromptModules[moduleId];
  const next: DetailPageSuiteMeta = { ...(meta ?? {}) };
  if (Object.keys(pendingPromptModules).length > 0) next.pendingPromptModules = pendingPromptModules;
  else delete next.pendingPromptModules;
  return Object.keys(next).length > 0 ? next : null;
}
