import type { Prisma } from "@prisma/client";

import {
  getEcomSeedVideoProject,
  type EcomSeedVideoProjectDto,
} from "@/lib/ecom/ecom-seed-video-service";
import type {
  SeedVideoChatMessage,
  SeedVideoPlan,
  SeedVideoReference,
  SeedVideoSettings,
  SeedVideoMeta,
} from "@/lib/ecom/ecom-seed-video-types";
import { prisma } from "@/lib/prisma";
import type { SeedVideoDirectPlan } from "@/lib/ecom/ecom-seed-video-types";

function resolveDirectVideoUrl(plan?: SeedVideoDirectPlan | null): string | undefined {
  if (!plan) return undefined;
  const fromList = plan.generatedVideos?.find((v) => v.videoUrl?.trim())?.videoUrl?.trim();
  if (fromList) return fromList;
  const legacy = plan.videoUrl?.trim();
  return legacy || undefined;
}

/** 种草视频完整工作流镜像（可一键复用：换参考图后直接生成） */
export type SeedVideoDeliverableSnapshot = {
  savedAt: string;
  title: string;
  /** 策划 Prompt（中间工作区） */
  planningPrompt?: string;
  references: SeedVideoReference[];
  chatHistory: SeedVideoChatMessage[];
  plan: SeedVideoPlan | null;
  settings: SeedVideoSettings;
  workflow?: SeedVideoMeta["workflow"];
  /** 成片预览（资产库缩略） */
  finalVideoUrl?: string;
  videoAssetId?: string;
};

function sanitizeTitleSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "种草视频";
}

function formatSnapshotTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function buildSeedVideoDeliverableSnapshotTitle(workName: string): string {
  const base = sanitizeTitleSegment(workName.trim() || "种草视频");
  return `${base}_${formatSnapshotTimestamp()}`;
}

function resolveFinalVideoUrl(project: EcomSeedVideoProjectDto): string | undefined {
  const fromPlan =
    project.plan?.render?.finalVideoUrl?.trim() ||
    project.plan?.directVideo?.videoUrl?.trim() ||
    resolveDirectVideoUrl(project.plan?.directVideo) ||
    project.videoOssUrl?.trim();
  return fromPlan && /^https?:\/\//.test(fromPlan) ? fromPlan : undefined;
}

export function assertSeedVideoReadyToSave(project: EcomSeedVideoProjectDto): void {
  const materials = project.references.filter((r) => r.role === "seed-material");
  if (materials.length === 0) {
    throw new Error("请先上传参考素材");
  }
  const planningPrompt =
    typeof project.meta?.planningPrompt === "string"
      ? project.meta.planningPrompt.trim()
      : "";
  if (!planningPrompt) {
    throw new Error("请先填写策划 Prompt");
  }
  const hasScript =
    (project.plan?.shots?.length ?? 0) >= 1 ||
    Boolean(project.plan?.directVideo?.globalPrompt?.trim()) ||
    (project.plan?.scripts?.length ?? 0) >= 1;
  if (!hasScript) {
    throw new Error("请先确认脚本或成片参数后再保存");
  }
}

export function buildSeedVideoDeliverableSnapshot(
  project: EcomSeedVideoProjectDto,
  workName: string,
): SeedVideoDeliverableSnapshot {
  const savedAt = new Date().toISOString();
  const planningPrompt =
    typeof project.meta?.planningPrompt === "string"
      ? project.meta.planningPrompt.trim()
      : undefined;
  const finalVideoUrl = resolveFinalVideoUrl(project);

  return {
    savedAt,
    title: buildSeedVideoDeliverableSnapshotTitle(workName),
    planningPrompt,
    references: project.references,
    chatHistory: project.chatHistory,
    plan: project.plan,
    settings: project.settings,
    workflow: project.meta?.workflow as SeedVideoMeta["workflow"] | undefined,
    finalVideoUrl,
    videoAssetId: project.videoAssetId ?? undefined,
  };
}

export async function saveSeedVideoDeliverableSnapshot(
  projectId: string,
  snapshot: SeedVideoDeliverableSnapshot,
): Promise<void> {
  const existing = await prisma.ecomSeedVideoProject.findFirst({
    where: { id: projectId },
    select: { meta: true },
  });
  const prevMeta = (existing?.meta as Record<string, unknown> | null) ?? {};
  const history = Array.isArray(prevMeta.deliverableSnapshotHistory)
    ? (prevMeta.deliverableSnapshotHistory as SeedVideoDeliverableSnapshot[])
    : [];
  const prevLatest = prevMeta.deliverableSnapshot as SeedVideoDeliverableSnapshot | undefined;
  const nextHistory =
    prevLatest && prevLatest.savedAt !== snapshot.savedAt
      ? [snapshot, ...history].slice(0, 12)
      : [snapshot, ...history.filter((h) => h.savedAt !== snapshot.savedAt)].slice(0, 12);

  await prisma.ecomSeedVideoProject.update({
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

export async function persistSeedVideoDeliverableSnapshot(opts: {
  userId: string;
  projectId: string;
  workName: string;
}): Promise<SeedVideoDeliverableSnapshot> {
  const project = await getEcomSeedVideoProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  assertSeedVideoReadyToSave(project);

  const snapshot = buildSeedVideoDeliverableSnapshot(project, opts.workName);
  await saveSeedVideoDeliverableSnapshot(opts.projectId, snapshot);
  return snapshot;
}
