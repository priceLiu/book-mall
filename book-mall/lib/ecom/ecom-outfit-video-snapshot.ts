import type { Prisma } from "@prisma/client";

import { getEcomOutfitVideoProject } from "@/lib/ecom/ecom-outfit-video-service";
import type { OutfitVideoProjectDto } from "@/lib/ecom/ecom-outfit-video-types";
import { prisma } from "@/lib/prisma";

export type OutfitVideoDeliverableSnapshot = {
  savedAt: string;
  title: string;
  templateId: string;
  phase: string;
  references: OutfitVideoProjectDto["references"];
  sceneList: OutfitVideoProjectDto["sceneList"];
  structured: OutfitVideoProjectDto["structured"];
  composeResult: OutfitVideoProjectDto["composeResult"];
};

function sanitizeTitleSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "穿搭视频";
}

function formatSnapshotTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function buildOutfitVideoDeliverableSnapshotTitle(workName: string): string {
  const base = sanitizeTitleSegment(workName.trim() || "穿搭视频");
  return `${base}_${formatSnapshotTimestamp()}`;
}

export function assertOutfitVideoReadyToSave(project: OutfitVideoProjectDto): void {
  if (!project.references.referenceVideo?.ossUrl?.trim()) {
    throw new Error("请先上传参考视频");
  }
  if (project.sceneList.length === 0) {
    throw new Error("请先完成拆镜");
  }
}

export async function buildOutfitVideoDeliverableSnapshot(
  userId: string,
  project: OutfitVideoProjectDto,
  workName: string,
): Promise<OutfitVideoDeliverableSnapshot> {
  return {
    savedAt: new Date().toISOString(),
    title: buildOutfitVideoDeliverableSnapshotTitle(workName),
    templateId: project.templateId,
    phase: project.phase,
    references: project.references,
    sceneList: project.sceneList,
    structured: project.structured,
    composeResult: project.composeResult,
  };
}

export async function saveOutfitVideoDeliverableSnapshotToMeta(
  projectId: string,
  snapshot: OutfitVideoDeliverableSnapshot,
): Promise<void> {
  const existing = await prisma.ecomVideoWorkflowProject.findFirst({
    where: { id: projectId },
    select: { meta: true },
  });
  const prevMeta = (existing?.meta as Record<string, unknown> | null) ?? {};
  const history = Array.isArray(prevMeta.deliverableSnapshotHistory)
    ? (prevMeta.deliverableSnapshotHistory as OutfitVideoDeliverableSnapshot[])
    : [];
  const prevLatest = prevMeta.deliverableSnapshot as OutfitVideoDeliverableSnapshot | undefined;
  const nextHistory =
    prevLatest && prevLatest.savedAt !== snapshot.savedAt
      ? [snapshot, ...history].slice(0, 12)
      : [snapshot, ...history.filter((h) => h.savedAt !== snapshot.savedAt)].slice(0, 12);

  await prisma.ecomVideoWorkflowProject.update({
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

export async function saveOutfitVideoDeliverableSnapshot(
  userId: string,
  projectId: string,
  workName: string,
): Promise<OutfitVideoDeliverableSnapshot> {
  const project = await getEcomOutfitVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  assertOutfitVideoReadyToSave(project);

  const snapshot = await buildOutfitVideoDeliverableSnapshot(userId, project, workName);
  await saveOutfitVideoDeliverableSnapshotToMeta(projectId, snapshot);
  return snapshot;
}
