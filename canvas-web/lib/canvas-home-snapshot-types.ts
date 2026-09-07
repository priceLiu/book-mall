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

/** 发现区（精选 / 模板 / 案例）是否无任何条目 */
export function isCanvasHomeDiscoveryEmpty(
  payload: CanvasHomeSnapshotPayload,
): boolean {
  return (
    payload.featured.length === 0 &&
    payload.templates.length === 0 &&
    payload.cases.length === 0
  );
}

/** 分镜视频 1.0 · 视频作品墙是否无任何条目 */
export function isCanvasHomeFilmShowcaseEmpty(
  payload: CanvasHomeSnapshotPayload,
): boolean {
  return payload.filmShowcase.length === 0;
}

/** 客户端是否仍需补拉快照缺失区块 */
export function canvasHomeNeedsClientHydrate(
  payload: CanvasHomeSnapshotPayload,
): boolean {
  return (
    isCanvasHomeDiscoveryEmpty(payload) ||
    isCanvasHomeFilmShowcaseEmpty(payload)
  );
}

export function isCanvasHomeSnapshotEmpty(
  payload: CanvasHomeSnapshotPayload,
): boolean {
  return (
    isCanvasHomeDiscoveryEmpty(payload) &&
    isCanvasHomeFilmShowcaseEmpty(payload)
  );
}
