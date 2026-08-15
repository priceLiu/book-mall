import type { SeedVideoPlan } from "@/lib/ecom/ecom-seed-video-types";

/** 单镜 I2V 服务端最长约 10min；超时视为 stale pending */
export const SEED_VIDEO_PENDING_SHOT_TTL_MS = 25 * 60 * 1000;

export type SeedVideoPendingShotEntry = {
  modelKey?: string;
  startedAt: string;
};

export type SeedVideoPendingShotsMap = Record<string, SeedVideoPendingShotEntry>;

function shotKey(shotIndex: number): string {
  return String(Math.trunc(shotIndex));
}

function readLegacyPending(
  meta: Record<string, unknown>,
): SeedVideoPendingShotsMap {
  const raw = meta.pendingShotVideo;
  if (!raw || typeof raw !== "object") return {};
  const shotIndex = (raw as { shotIndex?: number }).shotIndex;
  const startedAt = (raw as { startedAt?: string }).startedAt;
  if (typeof shotIndex !== "number" || !Number.isFinite(shotIndex)) return {};
  if (typeof startedAt !== "string" || !startedAt.trim()) return {};
  const modelKey = (raw as { modelKey?: string }).modelKey;
  return {
    [shotKey(shotIndex)]: {
      startedAt: startedAt.trim(),
      ...(modelKey?.trim() ? { modelKey: modelKey.trim() } : {}),
    },
  };
}

/** 读取 meta 中全部进行中的逐镜任务（含 legacy pendingShotVideo） */
export function readPendingShotVideos(
  meta: Record<string, unknown> | null | undefined,
): SeedVideoPendingShotsMap {
  if (!meta || typeof meta !== "object") return {};
  const raw = meta.pendingShotVideos;
  const fromMap =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? ({ ...(raw as SeedVideoPendingShotsMap) } as SeedVideoPendingShotsMap)
      : {};
  const legacy = readLegacyPending(meta);
  return { ...legacy, ...fromMap };
}

export function listPendingShotVideoIndices(
  meta: Record<string, unknown> | null | undefined,
): number[] {
  return Object.keys(readPendingShotVideos(meta))
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

export function isShotVideoPending(
  meta: Record<string, unknown> | null | undefined,
  shotIndex: number,
): boolean {
  return Boolean(readPendingShotVideos(meta)[shotKey(shotIndex)]);
}

export function markPendingShotVideo(
  meta: Record<string, unknown>,
  shotIndex: number,
  entry: SeedVideoPendingShotEntry,
): Record<string, unknown> {
  const next = { ...meta };
  const map = readPendingShotVideos(meta);
  map[shotKey(shotIndex)] = entry;
  next.pendingShotVideos = map;
  delete next.pendingShotVideo;
  return next;
}

export function clearPendingShotVideo(
  meta: Record<string, unknown>,
  shotIndex: number,
): Record<string, unknown> {
  const next = { ...meta };
  const map = readPendingShotVideos(meta);
  delete map[shotKey(shotIndex)];
  if (Object.keys(map).length === 0) {
    delete next.pendingShotVideos;
    delete next.pendingShotVideo;
  } else {
    next.pendingShotVideos = map;
    delete next.pendingShotVideo;
  }
  return next;
}

/** 清除已完成或超时的 pending，避免前端误判「生成中」 */
export function reconcileSeedVideoPendingShotMeta(opts: {
  meta: Record<string, unknown>;
  plan: SeedVideoPlan | null;
}): { meta: Record<string, unknown>; changed: boolean } {
  const map = readPendingShotVideos(opts.meta);
  const keys = Object.keys(map);
  if (keys.length === 0) return { meta: opts.meta, changed: false };

  let changed = false;
  const nextMap: SeedVideoPendingShotsMap = { ...map };

  for (const key of keys) {
    const shotIndex = Number.parseInt(key, 10);
    if (!Number.isFinite(shotIndex)) {
      delete nextMap[key];
      changed = true;
      continue;
    }
    const entry = map[key];
    if (!entry) continue;

    const shot = opts.plan?.shots?.find((s) => s.index === shotIndex);
    if (shot?.videoUrl?.trim()) {
      delete nextMap[key];
      changed = true;
      continue;
    }

    const startedAt = entry.startedAt ? Date.parse(entry.startedAt) : NaN;
    if (Number.isFinite(startedAt) && Date.now() - startedAt > SEED_VIDEO_PENDING_SHOT_TTL_MS) {
      delete nextMap[key];
      changed = true;
    }
  }

  if (!changed) return { meta: opts.meta, changed: false };

  const next = { ...opts.meta };
  if (Object.keys(nextMap).length === 0) {
    delete next.pendingShotVideos;
    delete next.pendingShotVideo;
  } else {
    next.pendingShotVideos = nextMap;
    delete next.pendingShotVideo;
  }
  return { meta: next, changed: true };
}
