import type { StoryboardProject } from "@/lib/storyboard-types";

export type StoryboardPendingPanelImageEntry = {
  modelKey?: string;
  startedAt: string;
};

export type StoryboardPendingPanelImagesMap = Record<
  string,
  StoryboardPendingPanelImageEntry
>;

function panelKey(index: number): string {
  return String(Math.trunc(index));
}

export function readStoryboardPendingPanelImages(
  meta: StoryboardProject["meta"],
): StoryboardPendingPanelImagesMap {
  const raw = meta?.workflow?.pendingPanelImages;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: StoryboardPendingPanelImagesMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const startedAt =
      typeof entry.startedAt === "string" ? entry.startedAt.trim() : "";
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

export function listStoryboardPendingPanelImageIndices(
  meta: StoryboardProject["meta"],
): number[] {
  return Object.keys(readStoryboardPendingPanelImages(meta))
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

export function isStoryboardPanelImagePending(
  meta: StoryboardProject["meta"],
  panelIndex: number,
): boolean {
  return Boolean(readStoryboardPendingPanelImages(meta)[panelKey(panelIndex)]);
}

export type StoryboardPendingPanelVideoEntry = {
  modelKey?: string;
  startedAt: string;
};

export type StoryboardPendingPanelVideosMap = Record<
  string,
  StoryboardPendingPanelVideoEntry
>;

export function readStoryboardPendingPanelVideos(
  meta: StoryboardProject["meta"],
): StoryboardPendingPanelVideosMap {
  const raw = meta?.workflow?.pendingPanelVideos;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: StoryboardPendingPanelVideosMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const startedAt =
      typeof entry.startedAt === "string" ? entry.startedAt.trim() : "";
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

export function listStoryboardPendingPanelVideoIndices(
  meta: StoryboardProject["meta"],
): number[] {
  return Object.keys(readStoryboardPendingPanelVideos(meta))
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

export function isStoryboardPanelVideoPending(
  meta: StoryboardProject["meta"],
  panelIndex: number,
): boolean {
  return Boolean(readStoryboardPendingPanelVideos(meta)[panelKey(panelIndex)]);
}
