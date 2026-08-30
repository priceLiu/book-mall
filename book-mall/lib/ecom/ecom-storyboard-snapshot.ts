import type { Prisma } from "@prisma/client";

import { mergeStoryboardPanelMediaByIndex } from "@/lib/ecom/ecom-storyboard-sheet-reconcile";
import { prisma } from "@/lib/prisma";
import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import type { StoryboardReference, StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";

export type StoryboardDeliverableSnapshot = {
  savedAt: string;
  title: string;
  productName?: string;
  productHighlight?: string;
  projectKeywords?: string;
  /** 策划定稿 Markdown（剧本 / 话术） */
  deliverableMarkdown?: string;
  sheet: StoryboardSheet;
  references: StoryboardReference[];
  sheetPngUrl?: string;
  videoUrl?: string;
  videoAssetId?: string;
  videoMode?: "full_sheet" | "merged_panels";
  /** 云端自动剪辑任务 ID（7 天限时下载） */
  renderJobId?: string;
  renderExpiresAt?: string;
  panelVideos: Array<{ index: number; videoUrl: string }>;
};

function panelVideosFromSheet(sheet: StoryboardSheet): StoryboardDeliverableSnapshot["panelVideos"] {
  return sheet.panels
    .filter((p) => Boolean(p.videoUrl?.trim()))
    .map((p) => ({ index: p.index, videoUrl: p.videoUrl!.trim() }));
}

/** 合并多个快照来源的分镜图/视频/参考图（工作流保存早于成片时使用） */
export function mergeStoryboardDeliverableSnapshotMedia(
  base: StoryboardDeliverableSnapshot,
  sources: Array<StoryboardDeliverableSnapshot | null | undefined>,
): StoryboardDeliverableSnapshot {
  let sheet = base.sheet;
  let references = base.references;
  let sheetPngUrl = base.sheetPngUrl;
  let videoUrl = base.videoUrl;
  let videoMode = base.videoMode;
  let videoAssetId = base.videoAssetId;
  let renderJobId = base.renderJobId;
  let renderExpiresAt = base.renderExpiresAt;
  let panelVideos = base.panelVideos;
  let projectKeywords = base.projectKeywords;

  for (const src of sources) {
    if (!src) continue;
    if (src.sheet?.panels?.length) {
      sheet = {
        ...sheet,
        panels: mergeStoryboardPanelMediaByIndex(sheet.panels, src.sheet.panels),
      };
    }
    if (src.references.length > 0 && references.length === 0) {
      references = src.references;
    }
    sheetPngUrl = sheetPngUrl ?? src.sheetPngUrl;
    videoUrl = videoUrl ?? src.videoUrl;
    videoMode = videoMode ?? src.videoMode;
    videoAssetId = videoAssetId ?? src.videoAssetId;
    renderJobId = renderJobId ?? src.renderJobId;
    renderExpiresAt = renderExpiresAt ?? src.renderExpiresAt;
    projectKeywords = projectKeywords ?? src.projectKeywords;
    if (panelVideos.length === 0 && src.panelVideos.length > 0) {
      panelVideos = src.panelVideos;
    }
  }

  const mergedPanelVideos = panelVideos.length > 0 ? panelVideos : panelVideosFromSheet(sheet);

  return {
    ...base,
    sheet,
    references,
    sheetPngUrl,
    videoUrl,
    videoMode,
    videoAssetId,
    renderJobId,
    renderExpiresAt,
    projectKeywords,
    panelVideos: mergedPanelVideos,
  };
}

export function buildStoryboardDeliverableSnapshot(opts: {
  sheet: StoryboardSheet;
  references: StoryboardReference[];
  sheetPngUrl?: string | null;
  videoUrl?: string | null;
  videoAssetId?: string | null;
  videoMode?: "full_sheet" | "merged_panels";
  renderJobId?: string | null;
  renderExpiresAt?: string | null;
  productName?: string;
  productHighlight?: string;
  projectKeywords?: string;
  deliverableMarkdown?: string | null;
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
    deliverableMarkdown: opts.deliverableMarkdown?.trim() || undefined,
    sheet: opts.sheet,
    references: opts.references,
    sheetPngUrl: opts.sheetPngUrl?.trim() || undefined,
    videoUrl: opts.videoUrl?.trim() || undefined,
    videoAssetId: opts.videoAssetId ?? undefined,
    videoMode: opts.videoMode,
    renderJobId: opts.renderJobId?.trim() || undefined,
    renderExpiresAt: opts.renderExpiresAt?.trim() || undefined,
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
  renderJobId?: string;
  renderExpiresAt?: string;
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
    renderJobId: opts.renderJobId,
    renderExpiresAt: opts.renderExpiresAt,
    productName: deliverable?.productName,
    productHighlight:
      project.sheet.overview.productHighlight ??
      (typeof deliverable?.params?.卖点 === "string" ? deliverable.params.卖点 : undefined),
    projectKeywords: pickProjectKeywords(project.meta as Record<string, unknown> | null),
    deliverableMarkdown: project.meta?.deliverableMarkdown,
  });

  await saveStoryboardDeliverableSnapshot(opts.projectId, snapshot);
  return snapshot;
}
