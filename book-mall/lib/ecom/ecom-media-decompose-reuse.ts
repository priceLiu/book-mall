import { Prisma } from "@prisma/client";

import { findMediaDecomposeSnapshotInProjectMeta } from "@/lib/ecom/ecom-library-service";
import type { MediaDecomposeDeliverableSnapshot } from "@/lib/ecom/ecom-media-decompose-snapshot";
import { getEcomMediaDecomposeProject } from "@/lib/ecom/ecom-media-decompose-service";
import type { MediaDecomposeProjectDto } from "@/lib/ecom/ecom-media-decompose-types";
import {
  ECOM_MEDIA_DECOMPOSE_MODULE,
  sanitizeMediaDecomposeReference,
  sanitizeMediaDecomposeResult,
  sanitizeMediaDecomposeSettings,
} from "@/lib/ecom/ecom-media-decompose-types";
import { prisma } from "@/lib/prisma";

function stripReplicaFromSnapshot(
  snap: MediaDecomposeDeliverableSnapshot,
): MediaDecomposeDeliverableSnapshot {
  if (!snap.replica) return snap;
  return {
    ...snap,
    replica: {
      ...snap.replica,
      shots: snap.replica.shots.map((s) => ({
        ...s,
        videoUrl: undefined,
        ttsUrl: undefined,
        videoTaskId: undefined,
      })),
      finalVideoUrl: undefined,
    },
  };
}

/** 从交付快照创建新项目（去掉成片与任务状态，保留拆解与镜头表结构） */
export async function createMediaDecomposeProjectFromSnapshot(
  userId: string,
  snap: MediaDecomposeDeliverableSnapshot,
): Promise<MediaDecomposeProjectDto> {
  const cleaned = stripReplicaFromSnapshot(snap);

  const row = await prisma.ecomMediaDecomposeProject.create({
    data: {
      userId,
      title: cleaned.title.slice(0, 120),
      module: ECOM_MEDIA_DECOMPOSE_MODULE,
      status: "ready",
      references: sanitizeMediaDecomposeReference(cleaned.media) as Prisma.InputJsonValue,
      settings: sanitizeMediaDecomposeSettings(cleaned.settings) as Prisma.InputJsonValue,
      result: sanitizeMediaDecomposeResult(cleaned.result) as Prisma.InputJsonValue,
      meta: {
        reusedFrom: {
          savedAt: cleaned.savedAt,
          title: cleaned.title,
          at: new Date().toISOString(),
        },
        deliverableSnapshot: cleaned,
        replicaSeedVideoProjectId: undefined,
      } as Prisma.InputJsonValue,
    },
  });

  const project = await getEcomMediaDecomposeProject(userId, row.id);
  if (!project) throw new Error("创建项目失败");
  return project;
}

/** 打开已有项目，或将历史快照复用到新项目 */
export async function reuseMediaDecomposeLibraryItem(
  userId: string,
  projectId: string,
  savedAt?: string,
): Promise<MediaDecomposeProjectDto> {
  const source = await getEcomMediaDecomposeProject(userId, projectId);
  if (!source) throw new Error("项目不存在");

  if (!savedAt) return source;

  const latest = source.meta?.deliverableSnapshot as MediaDecomposeDeliverableSnapshot | undefined;
  if (savedAt === latest?.savedAt) {
    return createMediaDecomposeProjectFromSnapshot(userId, latest);
  }

  const historical = findMediaDecomposeSnapshotInProjectMeta(source.meta, savedAt);
  if (!historical) throw new Error("找不到该版本的保存记录");
  return createMediaDecomposeProjectFromSnapshot(userId, historical);
}
