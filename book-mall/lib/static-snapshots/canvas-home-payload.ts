import type { PortalPublicCanvasTemplate } from "@/lib/canvas/portal-public-templates";
import type { PortalCaseProjectSummary } from "@/lib/canvas/canvas-portal-publish-service";
import type { PortalFeaturedProjectSummary } from "@/lib/canvas/canvas-project-service";
import type { PortalFilmShowcaseMedia } from "@/lib/canvas/sbv1-film-showcase";

export const CANVAS_HOME_PAGE_KEY = "canvas-home" as const;

export type CanvasHomeSnapshotPayload = {
  version: 1;
  featured: PortalFeaturedProjectSummary[];
  templates: PortalPublicCanvasTemplate[];
  cases: PortalCaseProjectSummary[];
  filmShowcase: PortalFilmShowcaseMedia[];
};

export type CanvasHomeSnapshotSummary = {
  featuredCount: number;
  templateCount: number;
  caseCount: number;
  filmShowcaseCount: number;
};

export function summarizeCanvasHomePayload(
  payload: CanvasHomeSnapshotPayload,
): CanvasHomeSnapshotSummary {
  return {
    featuredCount: payload.featured.length,
    templateCount: payload.templates.length,
    caseCount: payload.cases.length,
    filmShowcaseCount: payload.filmShowcase.length,
  };
}

export function isCanvasHomeSnapshotPayload(value: unknown): value is CanvasHomeSnapshotPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as CanvasHomeSnapshotPayload;
  return (
    v.version === 1 &&
    Array.isArray(v.featured) &&
    Array.isArray(v.templates) &&
    Array.isArray(v.cases) &&
    Array.isArray(v.filmShowcase)
  );
}
