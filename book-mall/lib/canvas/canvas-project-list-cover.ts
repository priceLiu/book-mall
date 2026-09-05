/**
 * 画布项目列表封面：成片悬停播放 + 分镜图/成片角标（sbv1 / Pro2 等共用）。
 */
import {
  isProjectThumbnailVideoUrl,
  pickPersistableProjectThumbnailUrl,
} from "@/lib/canvas/pick-project-thumbnail";

const LIST_COVER_IMAGE_NODE_TYPES = new Set([
  "sbv1-image",
  "story-pro2-image",
  "story-pro2-three-view",
  "image-engine",
  "three-view-engine",
  "image",
]);

const LIST_COVER_VIDEO_NODE_TYPES = new Set([
  "sbv1-video-engine",
  "video-engine",
  "story-pro2-video",
  "story-pro-video",
]);

export const LIST_COVER_MEDIA_NODE_TYPES = new Set([
  ...LIST_COVER_IMAGE_NODE_TYPES,
  ...LIST_COVER_VIDEO_NODE_TYPES,
]);

export type ProjectListCoverKind = "image" | "video";

export type ProjectListCover = {
  coverUrl: string;
  coverKind: ProjectListCoverKind;
  posterUrl?: string;
  hoverVideoUrl?: string;
};

type ListCoverEntry = {
  url: string;
  kind: ProjectListCoverKind;
  posterUrl?: string;
};

function readRuntime(data: Record<string, unknown>) {
  const runtime = data.runtime;
  return runtime && typeof runtime === "object" && !Array.isArray(runtime)
    ? (runtime as { ossUrl?: string; posterUrl?: string })
    : undefined;
}

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
  if (imageUrl.startsWith("http") && !isProjectThumbnailVideoUrl(imageUrl)) {
    return imageUrl;
  }

  return "";
}

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

/** 按节点顺序收集已入库图片 / 成片（去重） */
export function collectProjectListCoverEntries(canvas: unknown): ListCoverEntry[] {
  if (!canvas || typeof canvas !== "object") return [];
  const nodes = (canvas as { nodes?: unknown[] }).nodes;
  if (!Array.isArray(nodes)) return [];

  const out: ListCoverEntry[] = [];
  const seen = new Set<string>();

  for (const raw of nodes) {
    if (!raw || typeof raw !== "object") continue;
    const n = raw as { type?: string; data?: unknown };
    if (!n.type) continue;

    if (LIST_COVER_IMAGE_NODE_TYPES.has(n.type)) {
      const url = persistableImageUrlFromNodeData(n.data);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({ url, kind: "image" });
      continue;
    }

    if (LIST_COVER_VIDEO_NODE_TYPES.has(n.type)) {
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

/** 列表封面：优先最近成片（悬停播放），否则最近分镜图 */
export function resolveProjectListCover(canvas: unknown): ProjectListCover {
  const entries = collectProjectListCoverEntries(canvas);
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

  const fallback = pickPersistableProjectThumbnailUrl(canvas).trim();
  if (!fallback) return { coverUrl: "", coverKind: "image" };
  if (isProjectThumbnailVideoUrl(fallback)) {
    return {
      coverUrl: fallback,
      coverKind: "video",
      hoverVideoUrl: fallback,
    };
  }
  return { coverUrl: fallback, coverKind: "image" };
}

export function projectListCoverSummaryFields(canvas: unknown): {
  thumbnailUrl?: string;
  coverMediaKind?: ProjectListCoverKind;
  coverVideoUrl?: string;
  coverPosterUrl?: string;
} {
  const cover = resolveProjectListCover(canvas);
  if (cover.hoverVideoUrl) {
    return {
      thumbnailUrl: cover.coverUrl || cover.hoverVideoUrl,
      coverMediaKind: "video",
      coverVideoUrl: cover.hoverVideoUrl,
      coverPosterUrl: cover.posterUrl,
    };
  }
  if (cover.coverUrl) {
    return { thumbnailUrl: cover.coverUrl, coverMediaKind: "image" };
  }
  return {};
}

export type MetaListCover = {
  thumbnailUrl?: string;
  coverMediaKind?: ProjectListCoverKind;
  coverVideoUrl?: string;
  coverPosterUrl?: string;
};

export type ResolvedListCover = MetaListCover & {
  thumbnailUrl?: string;
};

/**
 * 列表行封面：优先 meta.listCover；旧项目无 embed 时从 nodes 回退解析成片。
 * thumbnailUrl 字段亦作兜底（历史仅存视频 URL 的项目）。
 */
export function resolveProjectListCoverForListRow(args: {
  meta: unknown;
  nodes?: unknown;
  storedThumbnailUrl?: string;
}): ResolvedListCover {
  const fromMeta = readListCoverFromMeta(args.meta);
  const stored = args.storedThumbnailUrl?.trim() ?? "";

  if (fromMeta?.coverVideoUrl?.trim()) {
    return {
      thumbnailUrl: fromMeta.thumbnailUrl ?? stored,
      coverMediaKind: fromMeta.coverMediaKind ?? "video",
      coverVideoUrl: fromMeta.coverVideoUrl,
      coverPosterUrl: fromMeta.coverPosterUrl,
    };
  }

  if (args.nodes) {
    const fromNodes = projectListCoverSummaryFields({ nodes: args.nodes });
    if (fromNodes.coverVideoUrl?.trim()) {
      return {
        thumbnailUrl: fromNodes.thumbnailUrl ?? fromMeta?.thumbnailUrl ?? stored,
        coverMediaKind: "video",
        coverVideoUrl: fromNodes.coverVideoUrl,
        coverPosterUrl: fromNodes.coverPosterUrl ?? fromMeta?.coverPosterUrl,
      };
    }
    if (fromNodes.coverMediaKind === "image" && fromNodes.thumbnailUrl) {
      return {
        thumbnailUrl: fromNodes.thumbnailUrl,
        coverMediaKind: "image",
      };
    }
  }

  if (fromMeta?.thumbnailUrl || fromMeta?.coverMediaKind) {
    return {
      thumbnailUrl: fromMeta.thumbnailUrl ?? stored,
      coverMediaKind: fromMeta.coverMediaKind,
      coverVideoUrl: fromMeta.coverVideoUrl,
      coverPosterUrl: fromMeta.coverPosterUrl,
    };
  }

  if (stored) {
    const asVideo = isProjectThumbnailVideoUrl(stored);
    return {
      thumbnailUrl: stored,
      coverMediaKind: asVideo ? "video" : "image",
      coverVideoUrl: asVideo ? stored : undefined,
    };
  }

  return {};
}

export function readListCoverFromMeta(meta: unknown): MetaListCover | null {
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as { listCover?: unknown }).listCover;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const coverMediaKind =
    o.coverMediaKind === "video" || o.coverMediaKind === "image"
      ? o.coverMediaKind
      : undefined;
  const thumbnailUrl =
    typeof o.thumbnailUrl === "string" ? o.thumbnailUrl.trim() : "";
  const coverVideoUrl =
    typeof o.coverVideoUrl === "string" ? o.coverVideoUrl.trim() : "";
  const coverPosterUrl =
    typeof o.coverPosterUrl === "string" ? o.coverPosterUrl.trim() : "";
  if (!coverMediaKind && !thumbnailUrl && !coverVideoUrl) return null;
  return {
    thumbnailUrl: thumbnailUrl || undefined,
    coverMediaKind,
    coverVideoUrl: coverVideoUrl || undefined,
    coverPosterUrl: coverPosterUrl || undefined,
  };
}

/** 保存画布时写入 meta.listCover，列表查询无需再拉全量 canvas */
export function embedListCoverInCanvas(canvas: unknown): unknown {
  if (!canvas || typeof canvas !== "object") return canvas;
  const cover = projectListCoverSummaryFields(canvas);
  const base = canvas as { meta?: Record<string, unknown> };
  const meta = { ...(base.meta ?? {}) };
  if (cover.thumbnailUrl || cover.coverMediaKind) {
    meta.listCover = cover;
  }
  return { ...base, meta };
}
