import type { QrCategory, QrTemplate } from "@/lib/qr-template-types";

/** 首页精选作品缓存键（与 browseKey 体系独立） */
export const QR_HOME_FEED_CACHE_KEY = "all|home";

/** 首页四宫格 · 不含场景 world */
export const QR_HOME_CARD_CATEGORIES = [
  "video",
  "image",
  "character",
  "audio",
] as const satisfies readonly QrCategory[];

export type QrHomeCardCategory = (typeof QR_HOME_CARD_CATEGORIES)[number];

export type QrHomeCategoryCard = {
  id: QrHomeCardCategory;
  title: string;
  description: string;
  backgroundUrls: string[];
};

export const QR_HOME_CATEGORY_CARD_META: Record<
  QrHomeCardCategory,
  Pick<QrHomeCategoryCard, "title" | "description">
> = {
  video: {
    title: "文生/图生视频",
    description: "选好示例，一键复制同款视频效果",
  },
  image: {
    title: "图像创作",
    description: "参考图快速生成同风格图像",
  },
  character: {
    title: "角色形象",
    description: "沉淀你的专属角色，随取随用",
  },
  audio: {
    title: "配音合成",
    description: "多音色配音，视频一步到位",
  },
};

const HOME_FEED_LIMIT = 36;
const HOME_CARD_BG_COUNT = 4;

function isKindThumbBuiltin(id: string): boolean {
  return (
    id.startsWith("builtin-image-") ||
    id.startsWith("builtin-character-") ||
    id.startsWith("builtin-world-") ||
    id.startsWith("builtin-video-") ||
    id.startsWith("builtin-audio-")
  );
}

function isGallerySeed(id: string): boolean {
  return (
    id.startsWith("qr-image-gallery-") ||
    id.startsWith("qr-character-gallery-") ||
    id.startsWith("qr-world-gallery-") ||
    id.startsWith("qr-world-api-") ||
    id.startsWith("qr-video-gallery-") ||
    id.startsWith("qr-motion-sync-gallery-")
  );
}

function isImageLikeUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(url);
}

function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

/** 首页卡片背景 · 优先封面图，避免 mp4 直链 */
export function resolveHomeCategoryCardImageUrl(t: QrTemplate): string | null {
  const thumb = t.thumbnailUrl?.trim() ?? "";
  if (thumb && !isVideoMediaUrl(thumb)) return thumb;

  const out = t.output?.url?.trim() ?? "";
  if (out && isImageLikeUrl(out)) return out;

  const slots = t.reference?.slots;
  const scene = slots?.sceneImages?.find((s) => s.url?.trim());
  if (scene?.url?.trim()) return scene.url.trim();

  const target = slots?.targetImage?.url?.trim();
  if (target) return target;

  const character = slots?.characterRefs?.find((s) => s.url?.trim());
  if (character?.url?.trim()) return character.url.trim();

  return null;
}

function hasVisualPreview(t: QrTemplate): boolean {
  return Boolean(resolveHomeCategoryCardImageUrl(t));
}

/** 首页瀑布流：库内 gallery / 用户作品 / 运营模板，排除 kind 占位缩略图 */
export function filterHomeGalleryTemplates(templates: QrTemplate[]): QrTemplate[] {
  const seen = new Set<string>();
  const out: QrTemplate[] = [];

  for (const t of templates) {
    if (!t?.id || seen.has(t.id)) continue;
    if (isKindThumbBuiltin(t.id)) continue;

    const gallery =
      isGallerySeed(t.id) ||
      (t.source === "user" && Boolean(t.output?.url?.trim())) ||
      t.source === "catalog";

    if (!gallery) continue;
    if (!hasVisualPreview(t)) continue;

    seen.add(t.id);
    out.push(t);
  }

  return out;
}

/** Fisher–Yates 洗牌（首页随机展示） */
export function shuffleQrTemplates<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function buildHomeFeedTemplates(merged: QrTemplate[]): QrTemplate[] {
  return shuffleQrTemplates(filterHomeGalleryTemplates(merged)).slice(0, HOME_FEED_LIMIT);
}

function pickCategoryBackgroundUrls(templates: QrTemplate[], max: number): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  const candidates = shuffleQrTemplates(
    templates.filter((t) => t?.id && !isKindThumbBuiltin(t.id) && hasVisualPreview(t)),
  );

  for (const t of candidates) {
    const url = resolveHomeCategoryCardImageUrl(t);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= max) break;
  }

  if (urls.length >= max) return urls;

  for (const t of templates) {
    const url = resolveHomeCategoryCardImageUrl(t);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= max) break;
  }

  return urls;
}

/** 首页四宫格 · 每类取若干作品图作背景 */
export function buildHomeCategoryCards(
  byCategory: Partial<Record<QrCategory, QrTemplate[]>>,
): QrHomeCategoryCard[] {
  return QR_HOME_CARD_CATEGORIES.map((id) => {
    const pool = byCategory[id] ?? [];
    const galleryPool = filterHomeGalleryTemplates(pool);
    const backgroundUrls = pickCategoryBackgroundUrls(
      galleryPool.length > 0 ? galleryPool : pool,
      HOME_CARD_BG_COUNT,
    );
    return {
      id,
      ...QR_HOME_CATEGORY_CARD_META[id],
      backgroundUrls,
    };
  });
}
