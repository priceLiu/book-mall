import type { Prisma } from "@prisma/client";

import { getEcomMediaDecomposeProject } from "@/lib/ecom/ecom-media-decompose-service";
import type {
  MediaDecomposeProjectDto,
  MediaDecomposeReference,
  MediaDecomposeResult,
  MediaDecomposeSettings,
} from "@/lib/ecom/ecom-media-decompose-types";
import { getEcomSeedVideoProject } from "@/lib/ecom/ecom-seed-video-service";
import type { SeedVideoReference, SeedVideoShot } from "@/lib/ecom/ecom-seed-video-types";
import { prisma } from "@/lib/prisma";

export type MediaDecomposeReplicaSnapshot = {
  seedVideoProjectId: string;
  references: SeedVideoReference[];
  shots: SeedVideoShot[];
  finalVideoUrl?: string;
  videoModelKey?: string;
};

/** 拆图拆视频完整工作流镜像（含拆解结果与可选一键复刻镜头表） */
export type MediaDecomposeDeliverableSnapshot = {
  savedAt: string;
  title: string;
  media: MediaDecomposeReference | null;
  settings: MediaDecomposeSettings;
  result: MediaDecomposeResult | null;
  replica?: MediaDecomposeReplicaSnapshot | null;
};

function sanitizeTitleSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "拆图拆视频";
}

function formatSnapshotTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function buildMediaDecomposeDeliverableSnapshotTitle(workName: string): string {
  const base = sanitizeTitleSegment(workName.trim() || "拆图拆视频");
  return `${base}_${formatSnapshotTimestamp()}`;
}

export function assertMediaDecomposeReadyToSave(project: MediaDecomposeProjectDto): void {
  if (!project.media?.ossUrl?.trim()) {
    throw new Error("请先上传图片或视频素材");
  }
  const raw = project.result?.rawText?.trim() ?? "";
  const structured = project.result?.structured;
  if (!raw && !structured) {
    throw new Error("请先完成拆解后再保存");
  }
}

async function loadReplicaSnapshot(
  userId: string,
  project: MediaDecomposeProjectDto,
): Promise<MediaDecomposeReplicaSnapshot | null> {
  const replicaId =
    typeof project.meta?.replicaSeedVideoProjectId === "string"
      ? project.meta.replicaSeedVideoProjectId.trim()
      : "";
  if (!replicaId) return null;

  const seedVideo = await getEcomSeedVideoProject(userId, replicaId);
  if (!seedVideo) return null;

  const finalVideoUrl =
    seedVideo.plan?.render?.finalVideoUrl?.trim() ||
    seedVideo.videoOssUrl?.trim() ||
    undefined;

  return {
    seedVideoProjectId: replicaId,
    references: seedVideo.references,
    shots: seedVideo.plan?.shots ?? [],
    finalVideoUrl,
    videoModelKey: seedVideo.settings.videoModelKey,
  };
}

export async function buildMediaDecomposeDeliverableSnapshot(
  userId: string,
  project: MediaDecomposeProjectDto,
  workName: string,
): Promise<MediaDecomposeDeliverableSnapshot> {
  const savedAt = new Date().toISOString();
  const replica = await loadReplicaSnapshot(userId, project);

  return {
    savedAt,
    title: buildMediaDecomposeDeliverableSnapshotTitle(workName),
    media: project.media,
    settings: project.settings,
    result: project.result,
    replica,
  };
}

export async function saveMediaDecomposeDeliverableSnapshot(
  projectId: string,
  snapshot: MediaDecomposeDeliverableSnapshot,
): Promise<void> {
  const existing = await prisma.ecomMediaDecomposeProject.findFirst({
    where: { id: projectId },
    select: { meta: true },
  });
  const prevMeta = (existing?.meta as Record<string, unknown> | null) ?? {};
  const history = Array.isArray(prevMeta.deliverableSnapshotHistory)
    ? (prevMeta.deliverableSnapshotHistory as MediaDecomposeDeliverableSnapshot[])
    : [];
  const prevLatest = prevMeta.deliverableSnapshot as MediaDecomposeDeliverableSnapshot | undefined;
  const nextHistory =
    prevLatest && prevLatest.savedAt !== snapshot.savedAt
      ? [snapshot, ...history].slice(0, 12)
      : [snapshot, ...history.filter((h) => h.savedAt !== snapshot.savedAt)].slice(0, 12);

  await prisma.ecomMediaDecomposeProject.update({
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

export async function persistMediaDecomposeDeliverableSnapshot(opts: {
  userId: string;
  projectId: string;
  workName: string;
}): Promise<MediaDecomposeDeliverableSnapshot> {
  const project = await getEcomMediaDecomposeProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  assertMediaDecomposeReadyToSave(project);

  const snapshot = await buildMediaDecomposeDeliverableSnapshot(
    opts.userId,
    project,
    opts.workName,
  );
  await saveMediaDecomposeDeliverableSnapshot(opts.projectId, snapshot);
  return snapshot;
}
