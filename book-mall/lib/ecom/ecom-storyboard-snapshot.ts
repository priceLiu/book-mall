import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import type { StoryboardReference, StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";

export type StoryboardDeliverableSnapshot = {
  savedAt: string;
  title: string;
  productName?: string;
  productHighlight?: string;
  projectKeywords?: string;
  sheet: StoryboardSheet;
  references: StoryboardReference[];
  sheetPngUrl?: string;
  videoUrl?: string;
  videoAssetId?: string;
  videoMode?: "full_sheet" | "merged_panels";
  panelVideos: Array<{ index: number; videoUrl: string }>;
};

export function buildStoryboardDeliverableSnapshot(opts: {
  sheet: StoryboardSheet;
  references: StoryboardReference[];
  sheetPngUrl?: string | null;
  videoUrl?: string | null;
  videoAssetId?: string | null;
  videoMode?: "full_sheet" | "merged_panels";
  productName?: string;
  productHighlight?: string;
  projectKeywords?: string;
}): StoryboardDeliverableSnapshot {
  const panelVideos = opts.sheet.panels
    .filter((p) => Boolean(p.videoUrl?.trim()))
    .map((p) => ({ index: p.index, videoUrl: p.videoUrl!.trim() }));

  return {
    savedAt: new Date().toISOString(),
    title: opts.sheet.overview.title,
    productName: opts.productName,
    productHighlight:
      opts.productHighlight ?? opts.sheet.overview.productHighlight ?? undefined,
    projectKeywords: opts.projectKeywords,
    sheet: opts.sheet,
    references: opts.references,
    sheetPngUrl: opts.sheetPngUrl?.trim() || undefined,
    videoUrl: opts.videoUrl?.trim() || undefined,
    videoAssetId: opts.videoAssetId ?? undefined,
    videoMode: opts.videoMode,
    panelVideos,
  };
}

export async function saveStoryboardDeliverableSnapshot(
  projectId: string,
  snapshot: StoryboardDeliverableSnapshot,
): Promise<void> {
  const existing = await prisma.ecomStoryboardProject.findFirst({
    where: { id: projectId },
    select: { meta: true },
  });
  const prevMeta = (existing?.meta as Record<string, unknown> | null) ?? {};
  const history = Array.isArray(prevMeta.deliverableSnapshotHistory)
    ? (prevMeta.deliverableSnapshotHistory as StoryboardDeliverableSnapshot[])
    : [];
  const prevLatest = prevMeta.deliverableSnapshot as StoryboardDeliverableSnapshot | undefined;
  const nextHistory =
    prevLatest && prevLatest.savedAt !== snapshot.savedAt
      ? [snapshot, ...history].slice(0, 8)
      : [snapshot, ...history.filter((h) => h.savedAt !== snapshot.savedAt)].slice(0, 8);

  await prisma.ecomStoryboardProject.update({
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

function pickProjectKeywords(meta: Record<string, unknown> | null | undefined): string | undefined {
  const deliverable = meta?.deliverable as { productName?: string; params?: Record<string, string> } | undefined;
  const params = deliverable?.params ?? {};
  return (
    (typeof params["关键词"] === "string" && params["关键词"]) ||
    (typeof params.keywords === "string" && params.keywords) ||
    (typeof params["项目关键词"] === "string" && params["项目关键词"]) ||
    deliverable?.productName ||
    undefined
  );
}

async function resolveStoryboardVideoOssUrl(
  userId: string,
  videoAssetId: string | null | undefined,
): Promise<string | undefined> {
  if (!videoAssetId) return undefined;
  const asset = await prisma.ecomAsset.findFirst({
    where: { id: videoAssetId, userId },
    select: { ossUrl: true },
  });
  const url = asset?.ossUrl?.trim();
  return url && /^https?:\/\//.test(url) ? url : undefined;
}

/** 从当前项目状态写入交付快照（成片完成后自动调用，也可手动触发） */
export async function persistStoryboardDeliverableSnapshot(opts: {
  userId: string;
  projectId: string;
  videoUrl?: string;
  videoAssetId?: string;
  videoMode?: "full_sheet" | "merged_panels";
}): Promise<StoryboardDeliverableSnapshot | null> {
  const project = await getEcomStoryboardProject(opts.userId, opts.projectId);
  if (!project?.sheet) return null;

  const videoAssetId = opts.videoAssetId ?? project.videoAssetId ?? undefined;
  const resolvedVideoUrl =
    opts.videoUrl?.trim() ||
    (await resolveStoryboardVideoOssUrl(opts.userId, videoAssetId));

  const deliverable = project.meta?.deliverable;
  const snapshot = buildStoryboardDeliverableSnapshot({
    sheet: project.sheet,
    references: project.references,
    sheetPngUrl: project.sheetPngUrl,
    videoUrl: resolvedVideoUrl,
    videoAssetId,
    videoMode: opts.videoMode,
    productName: deliverable?.productName,
    productHighlight:
      project.sheet.overview.productHighlight ??
      (typeof deliverable?.params?.卖点 === "string" ? deliverable.params.卖点 : undefined),
    projectKeywords: pickProjectKeywords(project.meta as Record<string, unknown> | null),
  });

  await saveStoryboardDeliverableSnapshot(opts.projectId, snapshot);
  return snapshot;
}
