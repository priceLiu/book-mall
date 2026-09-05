import type { Prisma } from "@prisma/client";

import {
  getEcomModelShotProject,
  type EcomModelShotProjectDto,
} from "@/lib/ecom/ecom-model-shot-service";
import {
  refByRole,
  type ModelShotBrief,
  type ModelShotChatMessage,
  type ModelShotMeta,
  type ModelShotPlan,
  type ModelShotReference,
  type ModelShotSettings,
} from "@/lib/ecom/ecom-model-shot-types";
import { prisma } from "@/lib/prisma";

/** 服装模特图完整工作流镜像（可一键复用：换参考图后继续生成） */
export type ModelShotDeliverableSnapshot = {
  savedAt: string;
  title: string;
  references: ModelShotReference[];
  brief: ModelShotBrief | null;
  settings: ModelShotSettings;
  chatHistory: ModelShotChatMessage[];
  plan: ModelShotPlan;
  meta: ModelShotMeta | null;
  thumbnailUrl?: string;
};

function sanitizeTitleSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "服装模特图";
}

function formatSnapshotTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function buildModelShotDeliverableSnapshotTitle(workName: string): string {
  const base = sanitizeTitleSegment(workName.trim() || "服装模特图");
  return `${base}_${formatSnapshotTimestamp()}`;
}

export function assertModelShotReadyToSave(project: EcomModelShotProjectDto): void {
  const garment = refByRole(project.references, "garment");
  if (!garment?.ossUrl?.trim()) {
    throw new Error("请先上传服装参考图");
  }
  if ((project.plan.items?.length ?? 0) < 1) {
    throw new Error("请先生成并确认姿势方案后再保存");
  }
}

function resolveThumbnailUrl(project: EcomModelShotProjectDto): string | undefined {
  const fromPose = project.plan.items.find((item) => item.imageUrl?.trim())?.imageUrl?.trim();
  if (fromPose) return fromPose;
  const garment = refByRole(project.references, "garment")?.ossUrl?.trim();
  return garment || undefined;
}

export function buildModelShotDeliverableSnapshot(
  project: EcomModelShotProjectDto,
  workName: string,
): ModelShotDeliverableSnapshot {
  return {
    savedAt: new Date().toISOString(),
    title: buildModelShotDeliverableSnapshotTitle(workName),
    references: project.references,
    brief: project.brief,
    settings: project.settings,
    chatHistory: project.chatHistory,
    plan: project.plan,
    meta: project.meta,
    thumbnailUrl: resolveThumbnailUrl(project),
  };
}

export async function saveModelShotDeliverableSnapshot(
  projectId: string,
  snapshot: ModelShotDeliverableSnapshot,
): Promise<void> {
  const existing = await prisma.ecomModelShotProject.findFirst({
    where: { id: projectId },
    select: { meta: true },
  });
  const prevMeta = (existing?.meta as Record<string, unknown> | null) ?? {};
  const history = Array.isArray(prevMeta.deliverableSnapshotHistory)
    ? (prevMeta.deliverableSnapshotHistory as ModelShotDeliverableSnapshot[])
    : [];
  const prevLatest = prevMeta.deliverableSnapshot as ModelShotDeliverableSnapshot | undefined;
  const nextHistory =
    prevLatest && prevLatest.savedAt !== snapshot.savedAt
      ? [snapshot, ...history].slice(0, 12)
      : [snapshot, ...history.filter((h) => h.savedAt !== snapshot.savedAt)].slice(0, 12);

  await prisma.ecomModelShotProject.update({
    where: { id: projectId },
    data: {
      meta: {
        ...prevMeta,
        deliverableSnapshot: snapshot,
        deliverableSnapshotHistory: nextHistory,
      } as Prisma.InputJsonValue,
    },
  });
}

export async function persistModelShotDeliverableSnapshot(opts: {
  userId: string;
  projectId: string;
  workName: string;
}): Promise<ModelShotDeliverableSnapshot> {
  const project = await getEcomModelShotProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  assertModelShotReadyToSave(project);

  const snapshot = buildModelShotDeliverableSnapshot(project, opts.workName);
  await saveModelShotDeliverableSnapshot(opts.projectId, snapshot);
  return snapshot;
}

export function collectModelShotSnapshotsFromMeta(
  meta: Record<string, unknown> | null | undefined,
): ModelShotDeliverableSnapshot[] {
  const out: ModelShotDeliverableSnapshot[] = [];
  const latest = meta?.deliverableSnapshot as ModelShotDeliverableSnapshot | undefined;
  const history = Array.isArray(meta?.deliverableSnapshotHistory)
    ? (meta!.deliverableSnapshotHistory as ModelShotDeliverableSnapshot[])
    : [];
  const seen = new Set<string>();
  for (const snap of [latest, ...history]) {
    if (!snap?.savedAt) continue;
    if (seen.has(snap.savedAt)) continue;
    seen.add(snap.savedAt);
    out.push(snap);
  }
  return out;
}

export function findModelShotSnapshotInProjectMeta(
  meta: Record<string, unknown> | null | undefined,
  savedAt: string,
): ModelShotDeliverableSnapshot | null {
  const latest = meta?.deliverableSnapshot as ModelShotDeliverableSnapshot | undefined;
  if (latest?.savedAt === savedAt) return latest;
  const history = Array.isArray(meta?.deliverableSnapshotHistory)
    ? (meta!.deliverableSnapshotHistory as ModelShotDeliverableSnapshot[])
    : [];
  return history.find((item) => item.savedAt === savedAt) ?? null;
}
