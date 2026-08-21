/**
 * 门户「影视案例」：仅展示已标记 portalFilmCase 的分镜视频 1.0 项目内已入库 OSS 图片/视频。
 */
import {
  canvasProjectEditionFromGraph,
  type CanvasProjectEdition,
} from "@/lib/canvas/canvas-story-edition";
import {
  isProjectThumbnailVideoUrl,
  pickPersistableProjectThumbnailUrl,
  pickPersistableProjectThumbnailUrlPreferVideo,
} from "@/lib/canvas/pick-project-thumbnail";
import { prisma } from "@/lib/prisma";

const SBV1_IMAGE_NODE = "sbv1-image";
const SBV1_VIDEO_NODE = "sbv1-video-engine";

export type PortalFilmShowcaseMediaKind = "image" | "video";

export type PortalFilmShowcaseMedia = {
  id: string;
  url: string;
  kind: PortalFilmShowcaseMediaKind;
  /** 视频封面（悬停播放前展示） */
  posterUrl?: string;
  sourceKind: "project";
  sourceId: string;
  projectName: string;
  description: string;
  owner?: { id: string; name: string | null; email: string | null } | null;
};

type Sbv1ShowcaseMediaEntry = {
  url: string;
  kind: PortalFilmShowcaseMediaKind;
  posterUrl?: string;
};

function readRuntime(data: Record<string, unknown>) {
  const runtime = data.runtime;
  return runtime && typeof runtime === "object" && !Array.isArray(runtime)
    ? (runtime as { ossUrl?: string; posterUrl?: string })
    : undefined;
}

/** 分镜图节点：优先 poster / ossUrl / imageUrl */
function persistableImageUrlFromNodeData(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  const runtime = readRuntime(d);

  const poster = runtime?.posterUrl?.trim();
  if (poster?.startsWith("http") && !isProjectThumbnailVideoUrl(poster)) {
    return poster;
  }

  const direct = typeof d.ossUrl === "string" ? d.ossUrl.trim() : "";
  if (direct.startsWith("http") && !isProjectThumbnailVideoUrl(direct)) return direct;

  const fromRuntime = runtime?.ossUrl?.trim();
  if (fromRuntime?.startsWith("http") && !isProjectThumbnailVideoUrl(fromRuntime)) {
    return fromRuntime;
  }

  const imageUrl = typeof d.imageUrl === "string" ? d.imageUrl.trim() : "";
  if (imageUrl.startsWith("http")) return imageUrl;

  return "";
}

/** 视频节点：优先 runtime.ossUrl / videoUrl，poster 仅作封面 */
function persistableVideoFromNodeData(data: unknown): {
  videoUrl: string;
  posterUrl?: string;
} {
  if (!data || typeof data !== "object") return { videoUrl: "" };
  const d = data as Record<string, unknown>;
  const runtime = readRuntime(d);
  const poster = runtime?.posterUrl?.trim();
  const posterUrl =
    poster?.startsWith("http") && !isProjectThumbnailVideoUrl(poster)
      ? poster
      : undefined;

  const candidates = [
    runtime?.ossUrl,
    typeof d.videoUrl === "string" ? d.videoUrl : "",
    typeof d.ossUrl === "string" ? d.ossUrl : "",
  ]
    .map((raw) => (typeof raw === "string" ? raw : "").trim())
    .filter((url) => url.startsWith("http"));

  const videoUrl =
    candidates.find((url) => isProjectThumbnailVideoUrl(url)) ?? candidates[0] ?? "";

  return { videoUrl, posterUrl };
}

/** 从 sbv1 媒体节点收集展示条目（按节点顺序，视频与分镜图分轨） */
export function collectSbv1ShowcaseMediaEntries(canvas: unknown): Sbv1ShowcaseMediaEntry[] {
  if (!canvas || typeof canvas !== "object") return [];
  const nodes = (canvas as { nodes?: unknown[] }).nodes;
  if (!Array.isArray(nodes)) return [];

  const out: Sbv1ShowcaseMediaEntry[] = [];
  const seen = new Set<string>();

  for (const raw of nodes) {
    if (!raw || typeof raw !== "object") continue;
    const n = raw as { type?: string; data?: unknown };

    if (n.type === SBV1_IMAGE_NODE) {
      const url = persistableImageUrlFromNodeData(n.data);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({ url, kind: "image" });
      continue;
    }

    if (n.type === SBV1_VIDEO_NODE) {
      const { videoUrl, posterUrl } = persistableVideoFromNodeData(n.data);
      if (videoUrl && !seen.has(videoUrl)) {
        seen.add(videoUrl);
        out.push({ url: videoUrl, kind: "video", posterUrl });
        continue;
      }
      if (posterUrl && !seen.has(posterUrl)) {
        seen.add(posterUrl);
        out.push({ url: posterUrl, kind: "image" });
      }
    }
  }

  return out;
}

/** 从 sbv1 节点收集全部已持久化媒体 URL（去重，保持节点顺序） */
export function collectSbv1PersistableMediaUrls(canvas: unknown): string[] {
  return collectSbv1ShowcaseMediaEntries(canvas).map((entry) => entry.url);
}

/** sbv1 列表封面：优先最近成片（悬停播放），无成片时用分镜图 */
export function resolveSbv1ProjectListCover(canvas: unknown): {
  coverUrl: string;
  coverKind: PortalFilmShowcaseMediaKind;
  posterUrl?: string;
  hoverVideoUrl?: string;
} {
  const entries = collectSbv1ShowcaseMediaEntries(canvas);
  const videos = entries.filter((e) => e.kind === "video");
  const images = entries.filter((e) => e.kind === "image");
  const latestVideo = videos.at(-1);
  if (latestVideo) {
    const poster = latestVideo.posterUrl?.trim();
    return {
      coverUrl: poster || latestVideo.url,
      coverKind: "video",
      posterUrl: poster || undefined,
      hoverVideoUrl: latestVideo.url,
    };
  }
  const latestImage = images.at(-1);
  if (latestImage) {
    return { coverUrl: latestImage.url, coverKind: "image" };
  }
  return { coverUrl: "", coverKind: "image" };
}

function blurbOf(p: {
  portalCaseBlurb: string;
  description: string;
}): string {
  return p.portalCaseBlurb?.trim() || p.description?.trim() || "";
}

function pinnedFilmShowcaseProjectIds(): string[] {
  return (process.env.PORTAL_FILM_SHOWCASE_PROJECT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  portalCaseBlurb: string;
  canvas: unknown;
  portalFilmCaseSort: number;
  updatedAt: Date;
  user: { id: string; name: string | null; email: string | null };
};

function flattenProjectMedia(
  p: ProjectRow,
  seenUrls: Set<string>,
  limit: number,
  out: PortalFilmShowcaseMedia[],
): void {
  if (out.length >= limit) return;

  const entries = collectSbv1ShowcaseMediaEntries(p.canvas);
  const thumb =
    p.thumbnailUrl?.trim() ||
    pickPersistableProjectThumbnailUrlPreferVideo(p.canvas) ||
    pickPersistableProjectThumbnailUrl(p.canvas);
  if (thumb && !entries.some((e) => e.url === thumb)) {
    entries.unshift({
      url: thumb,
      kind: isProjectThumbnailVideoUrl(thumb) ? "video" : "image",
    });
  }

  // 成片优先排列，分镜图一并展示
  const videos = entries.filter((e) => e.kind === "video");
  const images = entries.filter((e) => e.kind === "image");
  const ordered = [...videos, ...images];

  const description = blurbOf(p);
  for (const entry of ordered) {
    if (out.length >= limit || seenUrls.has(entry.url)) continue;
    seenUrls.add(entry.url);
    out.push({
      id: `${p.id}:${entry.url}`,
      url: entry.url,
      kind: entry.kind,
      posterUrl: entry.posterUrl,
      sourceKind: "project",
      sourceId: p.id,
      projectName: p.name,
      description,
      owner: p.user,
    });
  }
}

function isSbv1Canvas(canvas: unknown): boolean {
  return canvasProjectEditionFromGraph(canvas) === ("sbv1" satisfies CanvasProjectEdition);
}

async function fetchPortalFilmCaseSbv1Projects(): Promise<ProjectRow[]> {
  const pinned = pinnedFilmShowcaseProjectIds();
  const rows = await prisma.canvasProject.findMany({
    where: {
      deletedAt: null,
      OR: [
        { portalFilmCase: true },
        ...(pinned.length > 0 ? [{ id: { in: pinned } }] : []),
      ],
    },
    orderBy: [{ portalFilmCaseSort: "asc" }, { updatedAt: "desc" }],
    take: 20,
    select: {
      id: true,
      name: true,
      description: true,
      thumbnailUrl: true,
      portalCaseBlurb: true,
      canvas: true,
      portalFilmCaseSort: true,
      updatedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return rows.filter((row) => isSbv1Canvas(row.canvas)) as ProjectRow[];
}

const DEFAULT_LIMIT = 500;
const MAX_SHOWCASE_ITEMS = 500;

/** 门户首页 · 影视案例媒体墙（portalFilmCase 分镜 1.0） */
export async function listPortalFilmShowcaseMedia(
  limit = DEFAULT_LIMIT,
): Promise<PortalFilmShowcaseMedia[]> {
  const cap = Math.min(Math.max(limit, 1), MAX_SHOWCASE_ITEMS);
  const seenUrls = new Set<string>();
  const out: PortalFilmShowcaseMedia[] = [];

  const projects = await fetchPortalFilmCaseSbv1Projects();
  for (const p of projects) {
    flattenProjectMedia(p, seenUrls, cap, out);
    if (out.length >= cap) break;
  }

  return out;
}

/** 是否允许作为影视案例复制到用户账户 */
export async function isPortalFilmShowcaseProject(projectId: string): Promise<boolean> {
  const pinned = pinnedFilmShowcaseProjectIds();
  const p = await prisma.canvasProject.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      OR: [{ portalFilmCase: true }, ...(pinned.length > 0 ? [{ id: { in: pinned } }] : [])],
    },
    select: { canvas: true },
  });
  if (!p) return false;
  return isSbv1Canvas(p.canvas);
}

/** 管理员 · 影视案例项目列表（分镜 1.0） */
export async function listPortalFilmCaseProjectIds(): Promise<string[]> {
  const projects = await fetchPortalFilmCaseSbv1Projects();
  return projects.map((p) => p.id);
}
