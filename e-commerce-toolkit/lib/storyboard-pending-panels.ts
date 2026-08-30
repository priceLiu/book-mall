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
  opts?: { maxAgeMs?: number; now?: number },
): number[] {
  const map = readStoryboardPendingPanelImages(meta);
  const now = opts?.now ?? Date.now();
  const maxAgeMs = opts?.maxAgeMs;
  return Object.entries(map)
    .map(([key, entry]) => ({
      index: Number.parseInt(key, 10),
      startedAt: entry.startedAt,
    }))
    .filter(({ index, startedAt }) => {
      if (!Number.isFinite(index) || index <= 0) return false;
      if (maxAgeMs == null) return true;
      const t = new Date(startedAt).getTime();
      if (Number.isNaN(t)) return false;
      return now - t <= maxAgeMs;
    })
    .map(({ index }) => index)
    .sort((a, b) => a - b);
}

/** 无进行中 HTTP 时，meta pending 但 sheet 无图视为过期 */
export function listOrphanStoryboardPendingPanelImageIndices(
  meta: StoryboardProject["meta"],
  panels: readonly { index: number; imageUrl?: string | null }[],
  opts: { imageGenInFlight: boolean; inFlightWatchIndices: readonly number[] },
): number[] {
  const map = readStoryboardPendingPanelImages(meta);
  const orphans: number[] = [];
  for (const [key, entry] of Object.entries(map)) {
    const index = Number.parseInt(key, 10);
    if (!Number.isFinite(index) || index <= 0) continue;
    const hasImage = panels.some(
      (p) => p.index === index && Boolean(p.imageUrl?.trim()),
    );
    if (hasImage) {
      orphans.push(index);
      continue;
    }
    if (opts.imageGenInFlight || opts.inFlightWatchIndices.includes(index)) continue;
    orphans.push(index);
  }
  return orphans.sort((a, b) => a - b);
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

/**
 * 合并本地 busy 与 meta pending。
 * sheet 已有 videoUrl、且仅 stale pending（不在 panelVidBusyPanels）时不展示生成中。
 */
/**
 * 合并本地 busy、meta pending 与 HTTP 进行中的 watch。
 * sheet 已有 imageUrl、且不在 in-flight watch 时不展示生成中（含 stale pending）。
 */
export function resolveActiveStoryboardPanelImageBusyIndices(opts: {
  regeneratingPanels: readonly number[];
  pendingPanelIndices: readonly number[];
  inFlightWatchIndices: readonly number[];
  imageGenInFlight: boolean;
  panels: readonly { index: number; imageUrl?: string | null }[];
}): number[] {
  const set = new Set<number>([
    ...opts.regeneratingPanels,
    ...opts.pendingPanelIndices,
  ]);
  if (opts.imageGenInFlight) {
    for (const idx of opts.inFlightWatchIndices) set.add(idx);
  }
  /** 局部批量：仅 watch/regenerating 中的镜展示生成中，忽略无关 meta pending */
  const selectiveInFlight =
    opts.imageGenInFlight && opts.inFlightWatchIndices.length > 0;
  for (const idx of opts.pendingPanelIndices) {
    if (
      opts.inFlightWatchIndices.includes(idx) ||
      opts.regeneratingPanels.includes(idx)
    ) {
      continue;
    }
    const hasImage = opts.panels.some(
      (p) => p.index === idx && Boolean(p.imageUrl?.trim()),
    );
    if (hasImage) set.delete(idx);
    else if (selectiveInFlight || !opts.imageGenInFlight) {
      set.delete(idx);
    }
  }
  for (const idx of opts.regeneratingPanels) {
    if (opts.inFlightWatchIndices.includes(idx)) continue;
    if (opts.pendingPanelIndices.includes(idx)) continue;
    const hasImage = opts.panels.some(
      (p) => p.index === idx && Boolean(p.imageUrl?.trim()),
    );
    if (hasImage) set.delete(idx);
  }
  return [...set].sort((a, b) => a - b);
}

export function resolveActiveStoryboardPanelVideoBusyIndices(opts: {
  panelVidBusyPanels: readonly number[];
  pendingPanelVideoIndices: readonly number[];
  panels: readonly { index: number; videoUrl?: string | null }[];
}): number[] {
  const set = new Set<number>([
    ...opts.panelVidBusyPanels,
    ...opts.pendingPanelVideoIndices,
  ]);
  for (const idx of opts.pendingPanelVideoIndices) {
    if (opts.panelVidBusyPanels.includes(idx)) continue;
    const hasVideo = opts.panels.some(
      (p) => p.index === idx && Boolean(p.videoUrl?.trim()),
    );
    if (hasVideo) set.delete(idx);
  }
  return [...set].sort((a, b) => a - b);
}
