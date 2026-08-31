import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** 与 background-generation-dock-policy BACKGROUND_DOCK_PERSISTENT_MS 一致 */
export const MODEL_SHOT_POSE_PENDING_STALE_MS = 15 * 60 * 1000;

export type ModelShotPendingPoseImageEntry = {
  startedAt: string;
  modelKey?: string;
};

export type ModelShotPendingPoseImagesMap = Record<
  string,
  ModelShotPendingPoseImageEntry
>;

function poseKey(index: number): string {
  return String(Math.trunc(index));
}

export function readModelShotPendingPoseImages(
  meta: unknown,
): ModelShotPendingPoseImagesMap {
  const workflow = (meta as Record<string, unknown> | null)?.workflow as
    | Record<string, unknown>
    | undefined;
  const raw = workflow?.pendingPoseImages;
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

export function listModelShotPendingPoseImageIndices(meta: unknown): number[] {
  return Object.keys(readModelShotPendingPoseImages(meta))
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

function isPendingEntryStale(
  entry: ModelShotPendingPoseImageEntry,
  nowMs: number = Date.now(),
): boolean {
  const t = new Date(entry.startedAt).getTime();
  if (Number.isNaN(t)) return true;
  return nowMs - t > MODEL_SHOT_POSE_PENDING_STALE_MS;
}

async function patchModelShotWorkflowMeta(
  projectId: string,
  mutate: (workflow: Record<string, unknown>) => void,
): Promise<void> {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const existing = await prisma.ecomModelShotProject.findFirst({
      where: { id: projectId },
      select: { meta: true, updatedAt: true },
    });
    if (!existing) throw new Error("项目不存在");
    const prevMeta = (existing.meta as Record<string, unknown> | null) ?? {};
    const workflow = {
      ...((prevMeta.workflow as Record<string, unknown> | undefined) ?? {}),
    };
    mutate(workflow);
    const nextMeta = { ...prevMeta, workflow };
    const updated = await prisma.ecomModelShotProject.updateMany({
      where: { id: projectId, updatedAt: existing.updatedAt },
      data: { meta: nextMeta as Prisma.InputJsonValue },
    });
    if (updated.count === 1) return;
    if (attempt === maxAttempts - 1) {
      throw new Error("工作流状态更新冲突，请稍后重试");
    }
  }
}

/** 认领可生成的姿势槽位（跳过近期 pending 中的 index，支持并发不同 index） */
export async function claimModelShotPoseImageGeneration(
  projectId: string,
  indexes: number[],
  modelKey?: string,
): Promise<number[]> {
  const startedAt = new Date().toISOString();
  const unique = [...new Set(indexes.filter((n) => Number.isFinite(n) && n > 0))].sort(
    (a, b) => a - b,
  );
  if (unique.length === 0) return [];

  let claimed: number[] = [];
  await patchModelShotWorkflowMeta(projectId, (workflow) => {
    const prev = readModelShotPendingPoseImages({ workflow });
    const next: ModelShotPendingPoseImagesMap = { ...prev };
    claimed = [];
    for (const index of unique) {
      const key = poseKey(index);
      const existing = next[key];
      if (existing && !isPendingEntryStale(existing)) continue;
      next[key] = {
        startedAt,
        ...(modelKey?.trim() ? { modelKey: modelKey.trim() } : {}),
      };
      claimed.push(index);
    }
    if (claimed.length === 0) return;
    workflow.pendingPoseImages = next;
    workflow.phase = "generate";
  });
  return claimed;
}

export async function markModelShotPoseImagesPending(
  projectId: string,
  indexes: number[],
  modelKey?: string,
): Promise<void> {
  const startedAt = new Date().toISOString();
  await patchModelShotWorkflowMeta(projectId, (workflow) => {
    const prev = readModelShotPendingPoseImages({ workflow });
    const next: ModelShotPendingPoseImagesMap = { ...prev };
    for (const index of indexes) {
      next[poseKey(index)] = {
        startedAt,
        ...(modelKey?.trim() ? { modelKey: modelKey.trim() } : {}),
      };
    }
    workflow.pendingPoseImages = next;
    workflow.phase = "generate";
  });
}

export async function clearModelShotPoseImagesPending(
  projectId: string,
  indexes: number[],
): Promise<void> {
  if (indexes.length === 0) return;
  await patchModelShotWorkflowMeta(projectId, (workflow) => {
    const prev = readModelShotPendingPoseImages({ workflow });
    const next = { ...prev };
    for (const index of indexes) {
      delete next[poseKey(index)];
    }
    if (Object.keys(next).length === 0) {
      delete workflow.pendingPoseImages;
    } else {
      workflow.pendingPoseImages = next;
    }
  });
}

/** 读项目时剔除 stale / 已有成图的 pending，返回被清理的 index */
export async function reconcileModelShotPendingOnRead(opts: {
  projectId: string;
  meta: unknown;
  planItems: Array<{ index: number; imageUrl?: string }>;
}): Promise<number[]> {
  const pending = readModelShotPendingPoseImages(opts.meta);
  const toClear: number[] = [];

  for (const [key, entry] of Object.entries(pending)) {
    const index = Number.parseInt(key, 10);
    if (!Number.isFinite(index) || index <= 0) continue;
    const hasImage = opts.planItems.some(
      (item) => item.index === index && Boolean(item.imageUrl?.trim()),
    );
    if (hasImage || isPendingEntryStale(entry)) {
      toClear.push(index);
    }
  }

  if (toClear.length === 0) return [];
  await clearModelShotPoseImagesPending(opts.projectId, toClear);
  return toClear;
}
