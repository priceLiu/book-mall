import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import {
  listCanvasTemplates,
  listPortalCaseProjects,
  listPortalFeaturedProjects,
  listPortalFilmShowcase,
} from "@/lib/canvas-api";
import {
  isCanvasHomeSnapshotEmpty,
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

/** 先静态快照，仍空则实时列表 */
export async function hydrateCanvasHomeSnapshotClient(
  base: string,
  seed: CanvasHomeSnapshotPayload,
  signal?: AbortSignal,
): Promise<CanvasHomeSnapshotPayload> {
  if (!isCanvasHomeSnapshotEmpty(seed)) return seed;
  const snap = await fetchCanvasHomeSnapshotClient(base, signal);
  if (snap && !isCanvasHomeSnapshotEmpty(snap)) return snap;
  const live = await fetchCanvasHomeLiveClient(base, signal);
  if (!isCanvasHomeSnapshotEmpty(live)) return live;
  return snap ?? live;
}
