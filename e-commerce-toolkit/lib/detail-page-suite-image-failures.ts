import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";

export type DetailPageSuiteImageGenFailureEntry = {
  message: string;
  failedAt: string;
  modelKey?: string;
};

function readRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

export function readDetailPageSuiteImageGenFailures(
  meta: DetailPageSuiteProject["meta"],
): Record<string, DetailPageSuiteImageGenFailureEntry> {
  const raw = readRecord(meta?.imageGenFailures);
  const out: Record<string, DetailPageSuiteImageGenFailureEntry> = {};
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
