import type {
  CanvasTemplateRecord,
  PortalCaseProjectSummary,
  PortalFeaturedProjectSummary,
  PortalFilmShowcaseMedia,
} from "@/lib/canvas-api";

export type CanvasHomeSnapshotPayload = {
  version: 1;
  featured: PortalFeaturedProjectSummary[];
  templates: CanvasTemplateRecord[];
  cases: PortalCaseProjectSummary[];
  filmShowcase: PortalFilmShowcaseMedia[];
};

export type CanvasHomeSnapshotFetchResult = {
  dateKey: string;
  stale: boolean;
  source: "snapshot" | "fallback";
  payload: CanvasHomeSnapshotPayload;
};

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

export function emptyCanvasHomeSnapshotPayload(): CanvasHomeSnapshotPayload {
  return {
    version: 1,
    featured: [],
    templates: [],
    cases: [],
    filmShowcase: [],
  };
}
