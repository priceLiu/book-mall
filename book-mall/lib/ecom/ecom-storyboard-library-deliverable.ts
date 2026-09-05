import {
  buildStoryboardDeliverableSnapshot,
  mergeStoryboardDeliverableSnapshotMedia,
  type StoryboardDeliverableSnapshot,
} from "@/lib/ecom/ecom-storyboard-snapshot";
import { resolveStoryboardMergedVideoUrl } from "@/lib/ecom/ecom-storyboard-merged-video";
import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import {
  buildStoryboardDeliverablePreviewFromWorkflow,
  findStoryboardWorkflowSnapshotInProjectMeta,
} from "@/lib/ecom/ecom-storyboard-workflow-snapshot";

/** 资产库 / 交付查阅：合并工作流快照 + 项目当前 sheet + 交付快照 + 成片 URL */
export async function resolveStoryboardLibraryDeliverableSnapshot(opts: {
  userId: string;
  projectId: string;
  savedAt?: string;
  fallbackTitle?: string;
}): Promise<StoryboardDeliverableSnapshot | null> {
  const project = await getEcomStoryboardProject(opts.userId, opts.projectId);
  if (!project?.sheet?.panels?.length) return null;

  const meta = (project.meta ?? {}) as Record<string, unknown>;
  const deliverableSnap = meta.deliverableSnapshot as StoryboardDeliverableSnapshot | undefined;
  const mergedVideoUrl =
    (await resolveStoryboardMergedVideoUrl(opts.userId, opts.projectId, project.meta)) ??
    project.videoOssUrl ??
    undefined;

  const live = buildStoryboardDeliverableSnapshot({
    sheet: project.sheet,
    references: project.references,
    sheetPngUrl: project.sheetPngUrl,
    videoUrl: mergedVideoUrl,
    videoAssetId: project.videoAssetId ?? deliverableSnap?.videoAssetId,
    videoMode:
      deliverableSnap?.videoMode ??
      (project.meta?.workflow as { videoMode?: "full_sheet" | "merged_panels" } | undefined)
        ?.videoMode,
    renderJobId: deliverableSnap?.renderJobId,
    renderExpiresAt: deliverableSnap?.renderExpiresAt,
    productName:
      deliverableSnap?.productName ??
      (project.meta?.deliverable as { productName?: string } | undefined)?.productName,
    productHighlight: project.sheet.overview.productHighlight,
    projectKeywords: deliverableSnap?.projectKeywords,
    deliverableMarkdown: project.meta?.deliverableMarkdown,
  });

  const workflowSnap = opts.savedAt
    ? findStoryboardWorkflowSnapshotInProjectMeta(meta, opts.savedAt)
    : null;

  if (workflowSnap) {
    const fromWorkflow = buildStoryboardDeliverablePreviewFromWorkflow(workflowSnap);
    const merged = mergeStoryboardDeliverableSnapshotMedia(fromWorkflow, [live, deliverableSnap]);
    return {
      ...merged,
      savedAt: workflowSnap.savedAt,
      title: opts.fallbackTitle?.trim() || workflowSnap.title,
    };
  }

  if (deliverableSnap?.savedAt && (!opts.savedAt || deliverableSnap.savedAt === opts.savedAt)) {
    const merged = mergeStoryboardDeliverableSnapshotMedia(deliverableSnap, [live]);
    return {
      ...merged,
      title: opts.fallbackTitle?.trim() || merged.title,
    };
  }

  return {
    ...live,
    savedAt: opts.savedAt ?? live.savedAt,
    title: opts.fallbackTitle?.trim() || live.title,
  };
}
