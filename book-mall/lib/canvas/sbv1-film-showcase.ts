/**
 * 门户「影视案例」：从分镜视频 1.0 画布提取已入库 OSS 图片/视频。
 */
import {
  canvasProjectEditionFromGraph,
  type CanvasProjectEdition,
} from "@/lib/canvas/canvas-story-edition";
import {
  isProjectThumbnailVideoUrl,
  pickPersistableProjectThumbnailUrl,
  pickProjectThumbnailUrl,
} from "@/lib/canvas/pick-project-thumbnail";
import { getPlatformGatewayAdminEmails } from "@/lib/gateway/platform-credential-copy";
import { prisma } from "@/lib/prisma";

const SBV1_MEDIA_NODE_TYPES = new Set(["sbv1-image", "sbv1-video-engine"]);

export type PortalFilmShowcaseMediaKind = "image" | "video";

export type PortalFilmShowcaseMedia = {
  id: string;
  url: string;
  kind: PortalFilmShowcaseMediaKind;
  /** project | template */
  sourceKind: "project" | "template";
  sourceId: string;
  projectName: string;
  description: string;
  owner?: { id: string; name: string | null; email: string | null } | null;
};

function readRuntime(data: Record<string, unknown>) {
  const runtime = data.runtime;
  return runtime && typeof runtime === "object" && !Array.isArray(runtime)
    ? (runtime as { ossUrl?: string; posterUrl?: string })
    : undefined;
}

/** 仅稳定 OSS / poster，避免 ephemeral 过期 */
function persistableUrlFromNodeData(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  const runtime = readRuntime(d);

  const poster = runtime?.posterUrl?.trim();
  if (poster?.startsWith("http")) return poster;

  const direct = typeof d.ossUrl === "string" ? d.ossUrl.trim() : "";
  if (direct.startsWith("http")) return direct;

  const fromRuntime = runtime?.ossUrl?.trim();
  if (fromRuntime?.startsWith("http")) return fromRuntime;

  const imageUrl = typeof d.imageUrl === "string" ? d.imageUrl.trim() : "";
  if (imageUrl.startsWith("http")) return imageUrl;

  const videoUrl = typeof d.videoUrl === "string" ? d.videoUrl.trim() : "";
  if (videoUrl.startsWith("http")) return videoUrl;

  return "";
}

function mediaKindFromUrl(url: string): PortalFilmShowcaseMediaKind {
  return isProjectThumbnailVideoUrl(url) ? "video" : "image";
}

/** 从 sbv1 节点收集全部已持久化媒体 URL（去重，保持节点顺序） */
export function collectSbv1PersistableMediaUrls(canvas: unknown): string[] {
  if (!canvas || typeof canvas !== "object") return [];
  const nodes = (canvas as { nodes?: unknown[] }).nodes;
  if (!Array.isArray(nodes)) return [];

  const urls: string[] = [];
  const seen = new Set<string>();
  for (const raw of nodes) {
    if (!raw || typeof raw !== "object") continue;
    const n = raw as { type?: string; data?: unknown };
    if (!n.type || !SBV1_MEDIA_NODE_TYPES.has(n.type)) continue;
    const url = persistableUrlFromNodeData(n.data);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function blurbOf(p: {
  portalCaseBlurb: string;
  portalFeaturedBlurb: string;
  description: string;
}): string {
  return (
    p.portalCaseBlurb?.trim() ||
    p.portalFeaturedBlurb?.trim() ||
    p.description?.trim() ||
    ""
  );
}

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  portalCaseBlurb: string;
  portalFeaturedBlurb: string;
  canvas: unknown;
  portalCase: boolean;
  portalFeatured: boolean;
  portalCaseSort: number;
  portalFeaturedSort: number;
  updatedAt: Date;
  user: { id: string; name: string | null; email: string | null };
};

function projectPriority(p: ProjectRow): number {
  if (p.portalCase) return 0;
  if (p.portalFeatured) return 1;
  return 2;
}

function flattenProjectMedia(
  p: ProjectRow,
  seenUrls: Set<string>,
  limit: number,
  out: PortalFilmShowcaseMedia[],
): void {
  if (out.length >= limit) return;

  const urls = collectSbv1PersistableMediaUrls(p.canvas);
  const thumb = p.thumbnailUrl?.trim() || pickPersistableProjectThumbnailUrl(p.canvas);
  if (thumb && !urls.includes(thumb)) urls.unshift(thumb);
  if (urls.length === 0) {
    const display = pickProjectThumbnailUrl(p.canvas);
    if (display && !urls.includes(display)) urls.push(display);
  }

  const description = blurbOf(p);
  for (const url of urls) {
    if (out.length >= limit || seenUrls.has(url)) continue;
    seenUrls.add(url);
    out.push({
      id: `${p.id}:${url}`,
      url,
      kind: mediaKindFromUrl(url),
      sourceKind: "project",
      sourceId: p.id,
      projectName: p.name,
      description,
      owner: p.user,
    });
  }
}

async function fetchSbv1ProjectCandidates(): Promise<ProjectRow[]> {
  const adminEmails = getPlatformGatewayAdminEmails();

  const [portalRows, adminRows] = await Promise.all([
    prisma.canvasProject.findMany({
      where: {
        deletedAt: null,
        OR: [{ portalCase: true }, { portalFeatured: true }],
      },
      orderBy: [{ portalCaseSort: "asc" }, { portalFeaturedSort: "asc" }, { updatedAt: "desc" }],
      take: 120,
      select: {
        id: true,
        name: true,
        description: true,
        thumbnailUrl: true,
        portalCaseBlurb: true,
        portalFeaturedBlurb: true,
        canvas: true,
        portalCase: true,
        portalFeatured: true,
        portalCaseSort: true,
        portalFeaturedSort: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.canvasProject.findMany({
      where: {
        deletedAt: null,
        user: { email: { in: adminEmails, mode: "insensitive" } },
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        id: true,
        name: true,
        description: true,
        thumbnailUrl: true,
        portalCaseBlurb: true,
        portalFeaturedBlurb: true,
        canvas: true,
        portalCase: true,
        portalFeatured: true,
        portalCaseSort: true,
        portalFeaturedSort: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const byId = new Map<string, ProjectRow>();
  for (const row of [...portalRows, ...adminRows]) {
    if (canvasProjectEditionFromGraph(row.canvas) !== ("sbv1" satisfies CanvasProjectEdition)) {
      continue;
    }
    if (!byId.has(row.id)) byId.set(row.id, row as ProjectRow);
  }

  return [...byId.values()].sort((a, b) => {
    const pa = projectPriority(a);
    const pb = projectPriority(b);
    if (pa !== pb) return pa - pb;
    const sortA = a.portalCase ? a.portalCaseSort : a.portalFeaturedSort;
    const sortB = b.portalCase ? b.portalCaseSort : b.portalFeaturedSort;
    if (sortA !== sortB) return sortA - sortB;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

type TemplateRow = {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  canvas: unknown;
  owner: { id: string; name: string | null; email: string | null } | null;
};

async function fetchSbv1TemplateCandidates(): Promise<TemplateRow[]> {
  const rows = await prisma.canvasTemplate.findMany({
    where: {
      edition: "sbv1",
      OR: [{ visibility: "public" }, { featured: true }, { builtin: true }],
    },
    orderBy: [{ featured: "desc" }, { forkCount: "desc" }, { updatedAt: "desc" }],
    take: 40,
    select: {
      id: true,
      name: true,
      description: true,
      thumbnail: true,
      canvas: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  return rows as TemplateRow[];
}

function flattenTemplateMedia(
  t: TemplateRow,
  seenUrls: Set<string>,
  limit: number,
  out: PortalFilmShowcaseMedia[],
): void {
  if (out.length >= limit) return;

  const urls = collectSbv1PersistableMediaUrls(t.canvas);
  const thumb = t.thumbnail?.trim() || pickPersistableProjectThumbnailUrl(t.canvas);
  if (thumb && !urls.includes(thumb)) urls.unshift(thumb);

  for (const url of urls) {
    if (out.length >= limit || seenUrls.has(url)) continue;
    seenUrls.add(url);
    out.push({
      id: `tpl-${t.id}:${url}`,
      url,
      kind: mediaKindFromUrl(url),
      sourceKind: "template",
      sourceId: t.id,
      projectName: t.name,
      description: t.description?.trim() ?? "",
      owner: t.owner,
    });
  }
}

const DEFAULT_LIMIT = 48;

/** 门户首页 · 影视案例媒体墙（sbv1 已入库 OSS 图/视频） */
export async function listPortalFilmShowcaseMedia(
  limit = DEFAULT_LIMIT,
): Promise<PortalFilmShowcaseMedia[]> {
  const cap = Math.min(Math.max(limit, 1), 96);
  const seenUrls = new Set<string>();
  const out: PortalFilmShowcaseMedia[] = [];

  const projects = await fetchSbv1ProjectCandidates();
  for (const p of projects) {
    flattenProjectMedia(p, seenUrls, cap, out);
    if (out.length >= cap) break;
  }

  if (out.length < cap) {
    const templates = await fetchSbv1TemplateCandidates();
    for (const t of templates) {
      flattenTemplateMedia(t, seenUrls, cap, out);
      if (out.length >= cap) break;
    }
  }

  return out;
}

/** 是否允许作为影视案例复制到用户账户 */
export async function isPortalFilmShowcaseProject(projectId: string): Promise<boolean> {
  const p = await prisma.canvasProject.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      canvas: true,
      portalCase: true,
      portalFeatured: true,
      user: { select: { email: true } },
    },
  });
  if (!p) return false;
  if (canvasProjectEditionFromGraph(p.canvas) !== "sbv1") return false;
  if (p.portalCase || p.portalFeatured) return true;
  const email = p.user.email?.trim().toLowerCase() ?? "";
  return getPlatformGatewayAdminEmails().includes(email);
}
