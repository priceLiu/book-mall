import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";

export type DetailPageSuitePromptSnapshot = {
  prompt: string;
  itemLabel: string;
  updatedAt: string;
};

export function readDetailPageSuitePromptSnapshots(
  meta: DetailPageSuiteProject["meta"],
): Record<string, DetailPageSuitePromptSnapshot> {
  const raw = meta?.promptSnapshots;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, DetailPageSuitePromptSnapshot> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.trim() || !value || typeof value !== "object") continue;
    const prompt = value.prompt?.trim();
    if (!prompt) continue;
    out[key] = {
      prompt,
      itemLabel: value.itemLabel?.trim() || key,
      updatedAt: value.updatedAt || new Date(0).toISOString(),
    };
  }
  return out;
}
