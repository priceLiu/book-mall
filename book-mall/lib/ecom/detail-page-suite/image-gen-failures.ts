import type { DetailPageSuiteMeta } from "./types";

export type DetailPageSuiteImageGenFailureEntry = {
  message: string;
  failedAt: string;
  modelKey?: string;
};

export type DetailPageSuiteImageGenFailuresMap = Record<
  string,
  DetailPageSuiteImageGenFailureEntry
>;

function readRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

export function readDetailPageSuiteImageGenFailures(
  meta: unknown,
): DetailPageSuiteImageGenFailuresMap {
  const raw = readRecord((meta as DetailPageSuiteMeta | null)?.imageGenFailures);
  const out: DetailPageSuiteImageGenFailuresMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.trim() || !value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const message = typeof entry.message === "string" ? entry.message.trim() : "";
    const failedAt = typeof entry.failedAt === "string" ? entry.failedAt.trim() : "";
    if (!message || !failedAt) continue;
    out[key] = {
      message,
      failedAt,
      ...(typeof entry.modelKey === "string" && entry.modelKey.trim()
        ? { modelKey: entry.modelKey.trim() }
        : {}),
    };
  }
  return out;
}

export function mergeDetailPageSuiteImageGenFailures(
  meta: DetailPageSuiteMeta | null | undefined,
  patch: DetailPageSuiteImageGenFailuresMap,
  clearKeys: string[] = [],
): DetailPageSuiteMeta {
  const failures = { ...readDetailPageSuiteImageGenFailures(meta) };
  for (const key of clearKeys) {
    delete failures[key.trim()];
  }
  for (const [key, entry] of Object.entries(patch)) {
    if (!key.trim()) continue;
    failures[key] = entry;
  }
  const next: DetailPageSuiteMeta = { ...(meta ?? {}) };
  if (Object.keys(failures).length > 0) next.imageGenFailures = failures;
  else delete next.imageGenFailures;
  return next;
}

export function formatDetailPageSuiteImageGenFailureLine(
  compositeKey: string,
  message: string,
  opts?: { itemLabel?: string },
): string {
  const label =
    opts?.itemLabel?.trim() ||
    compositeKey.split("::").slice(1).join("::").trim() ||
    compositeKey;
  return `${label}: ${message}`;
}

export function parseDetailPageSuiteImageGenFailureLine(line: string): {
  key: string;
  message: string;
} | null {
  const idx = line.indexOf(": ");
  if (idx <= 0) return null;
  return { key: line.slice(0, idx), message: line.slice(idx + 2) };
}
