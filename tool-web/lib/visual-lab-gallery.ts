/** 成果展：浏览器 localStorage，便于后续替换为主站/OSS 入库。 */

export const VISUAL_LAB_GALLERY_STORAGE_KEY = "visual-lab-gallery-v1";

/** 「保存到成果展」快照（分析室顶栏）每人上限 */
export const VISUAL_LAB_GALLERY_SNAPSHOT_MAX = 24;

/** 从模型回复保存的图片 / 视频上限（与图生视频库数量级规则对齐） */
export const VISUAL_LAB_REPLY_GALLERY_MAX_IMAGES = 20;
export const VISUAL_LAB_REPLY_GALLERY_MAX_VIDEOS = 10;

const STORAGE_HARD_CAP = 200;

export type VisualLabGalleryKind = "snapshot" | "reply-image" | "reply-video";

export type VisualLabSnapshotStats = {
  width: number;
  height: number;
  avgRgb: { r: number; g: number; b: number };
  brightness: number;
  aspectLabel: string;
};

export type VisualLabGalleryItem = {
  id: string;
  createdAt: string;
  kind: VisualLabGalleryKind;
  imageName: string;
  note: string;
  thumbDataUrl: string;
  stats: VisualLabSnapshotStats;
  /** 来自模型回复的原始 URL（外链可能有时效） */
  sourceUrl?: string;
};

export function looksLikeVideoUrl(url: string): boolean {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url.split("?")[0] ?? url;
  }
  return /\.(mp4|webm|mov|m4v|mkv)(\?.*)?$/i.test(path);
}

function galleryKindOf(x: VisualLabGalleryItem): VisualLabGalleryKind {
  return x.kind ?? "snapshot";
}

function countSnapshots(items: VisualLabGalleryItem[]): number {
  return items.filter((x) => galleryKindOf(x) === "snapshot").length;
}

function countReplyImages(items: VisualLabGalleryItem[]): number {
  return items.filter((x) => galleryKindOf(x) === "reply-image").length;
}

function countReplyVideos(items: VisualLabGalleryItem[]): number {
  return items.filter((x) => galleryKindOf(x) === "reply-video").length;
}

/** 视频占位缩略（data URL），成果展卡片仍用 Image 显示小图块 */
export const VISUAL_LAB_VIDEO_THUMB_DATA_URL =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" rx="8" fill="#1e1b4b"/><path d="M48 28v24l20-12-20-12z" fill="#e9d5ff"/></svg>`,
  );

export const VISUAL_LAB_VIDEO_PLACEHOLDER_STATS: VisualLabSnapshotStats = {
  width: 0,
  height: 0,
  avgRgb: { r: 0, g: 0, b: 0 },
  brightness: 0,
  aspectLabel: "—",
};

function safeParse(raw: string | null): VisualLabGalleryItem[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x): x is VisualLabGalleryItem =>
          typeof x === "object" &&
          x !== null &&
          typeof (x as VisualLabGalleryItem).id === "string" &&
          typeof (x as VisualLabGalleryItem).thumbDataUrl === "string",
      )
      .map((x) => ({
        ...x,
        kind: (x as VisualLabGalleryItem).kind ?? "snapshot",
        stats:
          (x as VisualLabGalleryItem).stats ?? VISUAL_LAB_VIDEO_PLACEHOLDER_STATS,
      }));
  } catch {
    return [];
  }
}

export function loadVisualLabGallery(): VisualLabGalleryItem[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(VISUAL_LAB_GALLERY_STORAGE_KEY));
}

export function persistVisualLabGallery(items: VisualLabGalleryItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    VISUAL_LAB_GALLERY_STORAGE_KEY,
    JSON.stringify(items.slice(0, STORAGE_HARD_CAP)),
  );
}

export function appendVisualLabGalleryItem(
  item: Omit<VisualLabGalleryItem, "kind"> & { kind?: VisualLabGalleryKind },
): VisualLabGalleryItem[] {
  const withKind: VisualLabGalleryItem = {
    ...item,
    kind: item.kind ?? "snapshot",
  };
  let next: VisualLabGalleryItem[] = [withKind, ...loadVisualLabGallery()];
  while (countSnapshots(next) > VISUAL_LAB_GALLERY_SNAPSHOT_MAX) {
    let drop: number | undefined;
    for (let i = next.length - 1; i >= 0; i--) {
      if (galleryKindOf(next[i]!) === "snapshot") {
        drop = i;
        break;
      }
    }
    if (drop === undefined) break;
    next = next.filter((_, i) => i !== drop);
  }
  next = next.slice(0, STORAGE_HARD_CAP);
  persistVisualLabGallery(next);
  return next;
}

export type AppendReplyResult =
  | { ok: true; items: VisualLabGalleryItem[] }
  | { ok: false; reason: "quota-image" | "quota-video" };

export function appendVisualLabReplyMediaItem(
  item: VisualLabGalleryItem,
): AppendReplyResult {
  const normalized: VisualLabGalleryItem = {
    ...item,
    kind: item.kind === "reply-video" ? "reply-video" : "reply-image",
  };
  const all = loadVisualLabGallery();
  if (normalized.kind === "reply-image") {
    if (countReplyImages(all) >= VISUAL_LAB_REPLY_GALLERY_MAX_IMAGES) {
      return { ok: false, reason: "quota-image" };
    }
  } else {
    if (countReplyVideos(all) >= VISUAL_LAB_REPLY_GALLERY_MAX_VIDEOS) {
      return { ok: false, reason: "quota-video" };
    }
  }
  const next = [normalized, ...all].slice(0, STORAGE_HARD_CAP);
  persistVisualLabGallery(next);
  return { ok: true, items: next };
}

export function removeVisualLabGalleryItem(id: string): VisualLabGalleryItem[] {
  const next = loadVisualLabGallery().filter((x) => x.id !== id);
  persistVisualLabGallery(next);
  return next;
}
