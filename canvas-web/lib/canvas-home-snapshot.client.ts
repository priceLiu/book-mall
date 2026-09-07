import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import {
  listCanvasTemplates,
  listPortalCaseProjects,
  listPortalFeaturedProjects,
  listPortalFilmShowcase,
} from "@/lib/canvas-api";
import {
  isCanvasHomeDiscoveryEmpty,
  isCanvasHomeFilmShowcaseEmpty,
  isCanvasHomeSnapshotPayload,
  type CanvasHomeSnapshotPayload,
} from "@/lib/canvas-home-snapshot-types";

/** 浏览器侧拉静态快照（匿名可读） */
export async function fetchCanvasHomeSnapshotClient(
  base: string,
  signal?: AbortSignal,
): Promise<CanvasHomeSnapshotPayload | null> {
  if (!base.trim()) return null;
  try {
    const { url, init } = resolveBookMallBrowserRequest(
      base,
      "/api/public/static-snapshots/canvas-home",
      { signal },
    );
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const data = (await res.json()) as { payload?: unknown };
    if (!isCanvasHomeSnapshotPayload(data.payload)) return null;
    return data.payload;
  } catch {
    return null;
  }
}

/** 发现区实时兜底（精选 / 模板 / 案例） */
export async function fetchCanvasHomeDiscoveryLiveClient(
  base: string,
  signal?: AbortSignal,
): Promise<
  Pick<CanvasHomeSnapshotPayload, "featured" | "templates" | "cases">
> {
  const init = signal ? { signal } : undefined;
  const [featuredR, templatesR, casesR] = await Promise.allSettled([
    listPortalFeaturedProjects(base, init),
    listCanvasTemplates(base, "public", init),
    listPortalCaseProjects(base, "pro2", init),
  ]);
  return {
    featured: featuredR.status === "fulfilled" ? featuredR.value : [],
    templates: templatesR.status === "fulfilled" ? templatesR.value : [],
    cases: casesR.status === "fulfilled" ? casesR.value : [],
  };
}

/** 分镜 1.0 视频作品墙实时兜底 */
export async function fetchCanvasHomeFilmShowcaseLiveClient(
  base: string,
  signal?: AbortSignal,
): Promise<CanvasHomeSnapshotPayload["filmShowcase"]> {
  try {
    return await listPortalFilmShowcase(base);
  } catch {
    return [];
  }
}

/** SSR 快照为空时的实时兜底（各接口均为公开 GET） */
export async function fetchCanvasHomeLiveClient(
  base: string,
  signal?: AbortSignal,
): Promise<CanvasHomeSnapshotPayload> {
  const init = signal ? { signal } : undefined;
  const [featuredR, templatesR, casesR, filmR] = await Promise.allSettled([
    listPortalFeaturedProjects(base, init),
    listCanvasTemplates(base, "public", init),
    listPortalCaseProjects(base, "pro2", init),
    listPortalFilmShowcase(base),
  ]);
  return {
    version: 1,
    featured: featuredR.status === "fulfilled" ? featuredR.value : [],
    templates: templatesR.status === "fulfilled" ? templatesR.value : [],
    cases: casesR.status === "fulfilled" ? casesR.value : [],
    filmShowcase: filmR.status === "fulfilled" ? filmR.value : [],
  };
}

function mergeDiscoveryFrom(
  seed: CanvasHomeSnapshotPayload,
  source: Pick<CanvasHomeSnapshotPayload, "featured" | "templates" | "cases">,
): CanvasHomeSnapshotPayload {
  return {
    ...seed,
    featured: source.featured.length > 0 ? source.featured : seed.featured,
    templates: source.templates.length > 0 ? source.templates : seed.templates,
    cases: source.cases.length > 0 ? source.cases : seed.cases,
  };
}

function mergeFilmShowcaseFrom(
  seed: CanvasHomeSnapshotPayload,
  source: Pick<CanvasHomeSnapshotPayload, "filmShowcase">,
): CanvasHomeSnapshotPayload {
  return {
    ...seed,
    filmShowcase:
      source.filmShowcase.length > 0 ? source.filmShowcase : seed.filmShowcase,
  };
}

/** 按区块补拉缺失数据（发现区与分镜 1.0 视频墙互不阻塞） */
export async function hydrateCanvasHomeSnapshotClient(
  base: string,
  seed: CanvasHomeSnapshotPayload,
  signal?: AbortSignal,
): Promise<CanvasHomeSnapshotPayload> {
  let next = seed;

  const snap = await fetchCanvasHomeSnapshotClient(base, signal);
  if (snap) {
    next = mergeDiscoveryFrom(next, snap);
    next = mergeFilmShowcaseFrom(next, snap);
  }

  if (isCanvasHomeDiscoveryEmpty(next)) {
    next = mergeDiscoveryFrom(
      next,
      await fetchCanvasHomeDiscoveryLiveClient(base, signal),
    );
  }

  if (isCanvasHomeFilmShowcaseEmpty(next)) {
    const film = await fetchCanvasHomeFilmShowcaseLiveClient(base, signal);
    next = mergeFilmShowcaseFrom(next, { filmShowcase: film });
  }

  return next;
}
