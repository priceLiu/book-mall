/**
 * 画布门户首页静态快照 · 构建 payload（Cron / 管理后台写路径）。
 */
import { listPortalCaseCanvasProjects } from "@/lib/canvas/canvas-portal-publish-service";
import { listPortalFeaturedCanvasProjects } from "@/lib/canvas/canvas-project-service";
import { listPortalPublicPro2CanvasTemplates } from "@/lib/canvas/portal-public-templates";
import { listPortalFilmShowcaseMedia } from "@/lib/canvas/sbv1-film-showcase";
import type { CanvasHomeSnapshotPayload } from "@/lib/static-snapshots/canvas-home-payload";

export async function buildCanvasHomeSnapshot(): Promise<CanvasHomeSnapshotPayload> {
  const [featured, templates, cases, filmShowcase] = await Promise.all([
    listPortalFeaturedCanvasProjects(),
    listPortalPublicPro2CanvasTemplates(),
    listPortalCaseCanvasProjects({ edition: "pro2" }),
    listPortalFilmShowcaseMedia(),
  ]);

  return {
    version: 1,
    featured,
    templates,
    cases,
    filmShowcase,
  };
}

/** 无 DB 快照时的 fallback（空列表，不查库） */
export function buildCanvasHomeSnapshotFallback(): CanvasHomeSnapshotPayload {
  return {
    version: 1,
    featured: [],
    templates: [],
    cases: [],
    filmShowcase: [],
  };
}
