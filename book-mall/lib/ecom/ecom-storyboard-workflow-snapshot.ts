import type { Prisma } from "@prisma/client";

import {
  getEcomStoryboardProject,
  type EcomStoryboardProjectDto,
} from "@/lib/ecom/ecom-storyboard-service";
import {
  buildStoryboardDeliverableSnapshot,
  type StoryboardDeliverableSnapshot,
} from "@/lib/ecom/ecom-storyboard-snapshot";
import type {
  StoryboardChatMessage,
  StoryboardReference,
  StoryboardSheet,
} from "@/lib/ecom/ecom-storyboard-types";
import { prisma } from "@/lib/prisma";

/** 微剧故事版完整工作流镜像（策划会话、服装交付物、分镜表与设置，可一键复用） */
export type StoryboardWorkflowSnapshot = {
  savedAt: string;
  /** 展示名：项目名_时间戳 */
  title: string;
  projectName?: string;
  brief: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  references: StoryboardReference[];
  chatHistory: StoryboardChatMessage[];
  sheet: StoryboardSheet | null;
  sheetPngUrl?: string;
  meta: EcomStoryboardProjectDto["meta"];
};

function sanitizeTitleSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "微剧故事版";
}

function formatSnapshotTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function buildStoryboardWorkflowSnapshotTitle(projectName: string): string {
  const base = sanitizeTitleSegment(projectName.trim() || "微剧故事版");
  return `${base}_${formatSnapshotTimestamp()}`;
}

export function storyboardWorkflowHasSaveableContent(
  project: EcomStoryboardProjectDto,
): boolean {
  if (project.references.length > 0) return true;
  if (project.chatHistory.length > 0) return true;
  if (project.sheet?.panels?.length) return true;
  const markdown = project.meta?.deliverableMarkdown?.trim();
  if (markdown && markdown.length > 0) return true;
  const deliverable = project.meta?.deliverable as Record<string, unknown> | undefined;
  if (Array.isArray(deliverable?.sellpoints) && deliverable.sellpoints.length > 0) {
    return true;
  }
  if (Array.isArray(deliverable?.voiceovers) && deliverable.voiceovers.length > 0) {
    return true;
  }
  if (
    deliverable?.storyboardVersions &&
    typeof deliverable.storyboardVersions === "object" &&
    Object.keys(deliverable.storyboardVersions as object).length > 0
  ) {
    return true;
  }
  if (Array.isArray(deliverable?.schemes) && deliverable.schemes.length > 0) return true;
  return false;
}

export function buildStoryboardWorkflowSnapshot(
  project: EcomStoryboardProjectDto,
  projectName: string,
): StoryboardWorkflowSnapshot {
  const savedAt = new Date().toISOString();
  const trimmed = projectName.trim();
  return {
    savedAt,
    title: buildStoryboardWorkflowSnapshotTitle(trimmed || project.title?.trim() || "微剧故事版"),
    projectName: trimmed || undefined,
    brief: project.brief,
    settings: project.settings,
    references: project.references,
    chatHistory: project.chatHistory,
    sheet: project.sheet,
    sheetPngUrl: project.sheetPngUrl?.trim() || undefined,
    meta: project.meta,
  };
}

export function buildStoryboardDeliverablePreviewFromWorkflow(
  snap: StoryboardWorkflowSnapshot,
): StoryboardDeliverableSnapshot {
  if (snap.sheet) {
    const deliverable = snap.meta?.deliverable;
    return buildStoryboardDeliverableSnapshot({
      sheet: snap.sheet,
      references: snap.references,
      sheetPngUrl: snap.sheetPngUrl,
      productName: deliverable?.productName ?? snap.projectName,
      productHighlight: snap.sheet.overview.productHighlight,
      deliverableMarkdown: snap.meta?.deliverableMarkdown,
    });
  }
  return {
    savedAt: snap.savedAt,
    title: snap.title,
    productName: snap.projectName ?? snap.meta?.deliverable?.productName,
    deliverableMarkdown: snap.meta?.deliverableMarkdown,
    sheet: {
      overview: {
        title: snap.title,
        logline: "—",
        productHighlight: snap.meta?.deliverable?.productName,
      },
      cast: [],
      panels: [],
    },
    references: snap.references,
    panelVideos: [],
  };
}

export async function saveStoryboardWorkflowSnapshot(
  projectId: string,
  snapshot: StoryboardWorkflowSnapshot,
): Promise<void> {
  const existing = await prisma.ecomStoryboardProject.findFirst({
    where: { id: projectId },
    select: { meta: true },
  });
  if (!existing) throw new Error("项目不存在");

  const prevMeta = (existing.meta as Record<string, unknown> | null) ?? {};
  const history = Array.isArray(prevMeta.workflowSnapshotHistory)
    ? (prevMeta.workflowSnapshotHistory as StoryboardWorkflowSnapshot[])
    : [];
  const prevLatest = prevMeta.workflowSnapshot as StoryboardWorkflowSnapshot | undefined;
  const nextHistory =
    prevLatest && prevLatest.savedAt !== snapshot.savedAt
      ? [snapshot, ...history].slice(0, 12)
      : [snapshot, ...history.filter((h) => h.savedAt !== snapshot.savedAt)].slice(0, 12);

  await prisma.ecomStoryboardProject.update({
    where: { id: projectId },
    data: {
      title: snapshot.projectName?.slice(0, 120) || undefined,
      meta: {
        ...prevMeta,
        workflowSnapshot: snapshot,
        workflowSnapshotHistory: nextHistory,
      } as Prisma.InputJsonValue,
    },
  });
}

async function syncStoryboardAssetProjectNames(opts: {
  userId: string;
  projectId: string;
  projectName: string;
}): Promise<void> {
  const rows = await prisma.ecomAsset.findMany({
    where: {
      userId: opts.userId,
      module: "storyboard-micro-drama",
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, meta: true },
  });
  for (const row of rows) {
    const meta = (row.meta as Record<string, unknown> | null) ?? {};
    if (meta.projectId !== opts.projectId) continue;
    await prisma.ecomAsset.update({
      where: { id: row.id },
      data: {
        meta: {
          ...meta,
          projectName: opts.projectName,
        } as Prisma.InputJsonValue,
      },
    });
  }
}

export async function persistStoryboardWorkflowSnapshot(opts: {
  userId: string;
  projectId: string;
  projectName: string;
}): Promise<StoryboardWorkflowSnapshot> {
  const project = await getEcomStoryboardProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (!storyboardWorkflowHasSaveableContent(project)) {
    throw new Error("请先上传参考图或与助手完成至少一步策划，再保存工作流");
  }

  const snapshot = buildStoryboardWorkflowSnapshot(project, opts.projectName);
  await saveStoryboardWorkflowSnapshot(opts.projectId, snapshot);
  await syncStoryboardAssetProjectNames({
    userId: opts.userId,
    projectId: opts.projectId,
    projectName: snapshot.projectName?.trim() || snapshot.title,
  });
  return snapshot;
}

export function findStoryboardWorkflowSnapshotInProjectMeta(
  meta: Record<string, unknown> | null | undefined,
  savedAt: string,
): StoryboardWorkflowSnapshot | null {
  const latest = meta?.workflowSnapshot as StoryboardWorkflowSnapshot | undefined;
  if (latest?.savedAt === savedAt) return latest;
  const history = Array.isArray(meta?.workflowSnapshotHistory)
    ? (meta!.workflowSnapshotHistory as StoryboardWorkflowSnapshot[])
    : [];
  return history.find((h) => h.savedAt === savedAt) ?? null;
}

export function stripStoryboardSheetGeneratedMedia(
  sheet: StoryboardSheet | null,
): StoryboardSheet | null {
  if (!sheet) return null;
  return {
    ...sheet,
    panels: sheet.panels.map((panel) => ({
      ...panel,
      imageUrl: undefined,
      videoUrl: undefined,
    })),
  };
}

export function collectStoryboardWorkflowSnapshotsFromMeta(
  meta: Record<string, unknown> | null | undefined,
): StoryboardWorkflowSnapshot[] {
  const out: StoryboardWorkflowSnapshot[] = [];
  const latest = meta?.workflowSnapshot as StoryboardWorkflowSnapshot | undefined;
  const history = Array.isArray(meta?.workflowSnapshotHistory)
    ? (meta!.workflowSnapshotHistory as StoryboardWorkflowSnapshot[])
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
