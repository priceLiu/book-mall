import type { ModelShotMeta, ModelShotPoseItem, ModelShotProject } from "@/lib/model-shot-types";

import { modelShotPoseHasGeneratedImage } from "@/lib/model-shot-pose-images";

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
  for (const item of opts.items) {
    if (item.status === "generating") set.add(item.index);
  }
  for (const idx of [...set]) {
    const item = opts.items.find((row) => row.index === idx);
    const hasImage = item ? modelShotPoseHasGeneratedImage(item) : false;
    const serverPending = opts.pendingIndices.includes(idx);
    // 服务端已落图且不再 pending → 立即解除 busy（批量 API 未返回时也同步）
    if (hasImage && !serverPending) {
      set.delete(idx);
    }
  }
  return [...set].sort((a, b) => a - b);
}

export function listOrphanModelShotPendingPoseIndices(
  meta: ModelShotMeta | null | undefined,
  items: readonly ModelShotPoseItem[],
  _opts: { localInFlight: boolean; localWatchIndices: readonly number[] },
): number[] {
  const map = readModelShotPendingPoseImages(meta);
  const orphans: number[] = [];
  const now = Date.now();

  for (const [key, entry] of Object.entries(map)) {
    const index = Number.parseInt(key, 10);
    if (!Number.isFinite(index) || index <= 0) continue;
    const item = items.find((row) => row.index === index);
    const hasImage = item ? modelShotPoseHasGeneratedImage(item) : false;
    if (hasImage) {
      orphans.push(index);
      continue;
    }
    const started = new Date(entry.startedAt).getTime();
    const stale =
      Number.isNaN(started) || now - started > MODEL_SHOT_POSE_PENDING_STALE_MS;
    if (stale) {
      orphans.push(index);
    }
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

export function modelShotTargetIndexesHaveImages(
  items: readonly ModelShotPoseItem[],
  indexes: readonly number[],
): boolean {
  return indexes.every((idx) => {
    const item = items.find((row) => row.index === idx);
    return item ? modelShotPoseHasGeneratedImage(item) : false;
  });
}

export function modelShotTargetIndexesGainedImages(
  beforeItems: readonly ModelShotPoseItem[],
  afterItems: readonly ModelShotPoseItem[],
  indexes: readonly number[],
): boolean {
  return indexes.some((idx) => {
    const before = beforeItems.find((row) => row.index === idx);
    const after = afterItems.find((row) => row.index === idx);
    if (!after || !modelShotPoseHasGeneratedImage(after)) return false;
    if (!before || !modelShotPoseHasGeneratedImage(before)) return true;
    const beforeUrl = before.imageUrl?.trim();
    const afterUrl = after.imageUrl?.trim();
    return Boolean(afterUrl && afterUrl !== beforeUrl);
  });
}
