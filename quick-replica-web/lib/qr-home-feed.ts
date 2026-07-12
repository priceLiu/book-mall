import type { QrTemplate } from "@/lib/qr-template-types";

/** 首页精选作品缓存键（与 browseKey 体系独立） */
export const QR_HOME_FEED_CACHE_KEY = "all|home";

const HOME_FEED_LIMIT = 36;

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

function hasVisualPreview(t: QrTemplate): boolean {
  const thumb = t.thumbnailUrl?.trim() ?? "";
  const out = t.output?.url?.trim() ?? "";
  return Boolean(thumb || out);
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
