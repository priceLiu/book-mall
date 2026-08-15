import type { SeedVideoProject } from "@/lib/seed-video-types";

export type SeedVideoPendingShotEntry = {
  modelKey?: string;
  startedAt: string;
};

export type SeedVideoPendingShotsMap = Record<string, SeedVideoPendingShotEntry>;

function shotKey(shotIndex: number): string {
  return String(Math.trunc(shotIndex));
}

function readLegacyPending(
  meta: NonNullable<SeedVideoProject["meta"]>,
): SeedVideoPendingShotsMap {
  const raw = meta.pendingShotVideo;
  if (!raw?.shotIndex || !raw.startedAt?.trim()) return {};
  return {
    [shotKey(raw.shotIndex)]: {
      startedAt: raw.startedAt.trim(),
      ...(raw.modelKey?.trim() ? { modelKey: raw.modelKey.trim() } : {}),
    },
  };
}

export function readPendingShotVideos(
  meta: SeedVideoProject["meta"],
): SeedVideoPendingShotsMap {
  if (!meta) return {};
  const raw = meta.pendingShotVideos;
  const fromMap =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? ({ ...(raw as SeedVideoPendingShotsMap) } as SeedVideoPendingShotsMap)
      : {};
  return { ...readLegacyPending(meta), ...fromMap };
}

export function listPendingShotVideoIndices(meta: SeedVideoProject["meta"]): number[] {
  return Object.keys(readPendingShotVideos(meta))
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

export function isShotVideoPending(
  meta: SeedVideoProject["meta"],
  shotIndex: number,
): boolean {
  return Boolean(readPendingShotVideos(meta)[shotKey(shotIndex)]);
}
