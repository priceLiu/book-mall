import type { ModelShotMeta, ModelShotPoseItem, ModelShotProject } from "@/lib/model-shot-types";

export type ModelShotPendingPoseImageEntry = {
  startedAt: string;
  modelKey?: string;
};

export type ModelShotPendingPoseImagesMap = Record<
  string,
  ModelShotPendingPoseImageEntry
>;

/** 与 book-mall/lib/ecom/ecom-model-shot-pending-images.ts 一致 */
export const MODEL_SHOT_POSE_PENDING_STALE_MS = 15 * 60 * 1000;

function poseKey(index: number): string {
  return String(Math.trunc(index));
}

export function readModelShotPendingPoseImages(
  meta: ModelShotMeta | null | undefined,
): ModelShotPendingPoseImagesMap {
  const raw = meta?.workflow?.pendingPoseImages;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ModelShotPendingPoseImagesMap = {};
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

export function listModelShotPendingPoseIndices(
  meta: ModelShotMeta | null | undefined,
): number[] {
  return Object.keys(readModelShotPendingPoseImages(meta))
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

export function resolveActiveModelShotPoseBusyIndexes(opts: {
  pendingIndices: readonly number[];
  localWatchIndices: readonly number[];
  items: readonly ModelShotPoseItem[];
}): number[] {
  const set = new Set<number>([...opts.pendingIndices, ...opts.localWatchIndices]);
  for (const idx of [...set]) {
    const hasImage = opts.items.some(
      (item) => item.index === idx && Boolean(item.imageUrl?.trim()),
    );
    const serverPending = opts.pendingIndices.includes(idx);
    if (hasImage && !serverPending && !opts.localWatchIndices.includes(idx)) {
      set.delete(idx);
    }
  }
  return [...set].sort((a, b) => a - b);
}

export function listOrphanModelShotPendingPoseIndices(
  meta: ModelShotMeta | null | undefined,
  items: readonly ModelShotPoseItem[],
  opts: { localInFlight: boolean; localWatchIndices: readonly number[] },
): number[] {
  const map = readModelShotPendingPoseImages(meta);
  const orphans: number[] = [];
  const now = Date.now();

  for (const [key, entry] of Object.entries(map)) {
    const index = Number.parseInt(key, 10);
    if (!Number.isFinite(index) || index <= 0) continue;
    const hasImage = items.some(
      (item) => item.index === index && Boolean(item.imageUrl?.trim()),
    );
    if (hasImage) {
      orphans.push(index);
      continue;
    }
    const started = new Date(entry.startedAt).getTime();
    const stale =
      Number.isNaN(started) || now - started > MODEL_SHOT_POSE_PENDING_STALE_MS;
    if (stale) {
      orphans.push(index);
      continue;
    }
    if (opts.localInFlight || opts.localWatchIndices.includes(index)) continue;
    orphans.push(index);
  }
  return orphans.sort((a, b) => a - b);
}

export function earliestModelShotPendingStartedAt(
  meta: ModelShotMeta | null | undefined,
  indices: readonly number[],
): string {
  const map = readModelShotPendingPoseImages(meta);
  let earliest = Date.now();
  let iso = new Date().toISOString();
  for (const index of indices) {
    const entry = map[poseKey(index)];
    if (!entry?.startedAt) continue;
    const t = new Date(entry.startedAt).getTime();
    if (!Number.isNaN(t) && t < earliest) {
      earliest = t;
      iso = entry.startedAt;
    }
  }
  return iso;
}

export function buildModelShotPendingMetaPatch(
  project: ModelShotProject,
  clearIndexes: number[],
): ModelShotMeta {
  const pendingMap = { ...readModelShotPendingPoseImages(project.meta) };
  for (const index of clearIndexes) {
    delete pendingMap[poseKey(index)];
  }
  const workflow = { ...(project.meta?.workflow ?? {}) };
  if (Object.keys(pendingMap).length === 0) {
    delete workflow.pendingPoseImages;
  } else {
    workflow.pendingPoseImages = pendingMap;
  }
  return { ...project.meta, workflow };
}

/** 模特图生成 Dock 任务唯一 id（同项目勿重复登记） */
export function modelShotImageDockTaskId(projectId: string): string {
  return `model-shot-image:${projectId}`;
}
