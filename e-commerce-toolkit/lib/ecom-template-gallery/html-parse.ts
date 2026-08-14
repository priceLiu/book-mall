import type {
  EcomTemplateCategory,
  EcomTemplateGalleryEntry,
  EcomTemplateMediaKind,
} from "./types";
import { splitYibaiAigcImageUrl } from "./yibaiaigc-image-url";

/** 从 HTML 文件名推断品类（如「箱包 图片.html」→ bags） */
const FILENAME_CATEGORY_HINTS: Array<{
  pattern: RegExp;
  category: EcomTemplateCategory;
}> = [
  { pattern: /女装/, category: "womens" },
  { pattern: /男装/, category: "mens" },
  { pattern: /童装/, category: "kids" },
  { pattern: /家纺/, category: "home-textile" },
  { pattern: /箱包/, category: "bags" },
  { pattern: /鞋子/, category: "shoes" },
  { pattern: /配饰/, category: "accessories" },
];

export function inferTemplateCategoryFromFilename(
  filename: string,
): EcomTemplateCategory | null {
  const base = filename.trim();
  if (!base) return null;
  for (const { pattern, category } of FILENAME_CATEGORY_HINTS) {
    if (pattern.test(base)) return category;
  }
  return null;
}

export function templateCategoryLabel(category: EcomTemplateCategory): string {
  const labels: Record<EcomTemplateCategory, string> = {
    womens: "女装",
    mens: "男装",
    kids: "童装",
    "home-textile": "家纺",
    bags: "箱包",
    shoes: "鞋子",
    accessories: "配饰",
  };
  return labels[category];
}

export type HtmlParsePresetId = "yibaiaigc-demo-card" | "custom";

export type HtmlParseConfig = {
  preset: HtmlParsePresetId;
  /** 块分割标记，如 class="DemoCard" */
  blockMarker: string;
  /** 图片 src 正则（须含捕获组 1 = URL） */
  imageSrcPattern: string;
  /** 视频 src 正则（须含捕获组 1 = URL） */
  videoSrcPattern: string;
  /** poster 正则（可选，捕获组 1） */
  posterPattern: string;
  /** 标题正则（捕获组 1） */
  titlePattern: string;
  hotKeyword: string;
};

export const YIBIAIGC_DEMO_CARD_CONFIG: HtmlParseConfig = {
  preset: "yibaiaigc-demo-card",
  blockMarker: 'class="DemoCard"',
  imageSrcPattern:
    'class="media-image"[^>]*src="(https:\\/\\/image\\.yibaiaigc[^"]+)"|src="(https:\\/\\/image\\.yibaiaigc[^"]+)"[^>]*class="media-image"',
  videoSrcPattern:
    '<video[^>]*src="([^"]+)"|<source[^>]*src="([^"]+\\.(?:mp4|webm)[^"]*)"',
  posterPattern: 'poster="([^"]+)"',
  titlePattern: "DemoCard-banner[\\s\\S]*?<span[^>]*>([^<]+)<\\/span>",
  hotKeyword: "爆款",
};

export const DEFAULT_CUSTOM_PARSE_CONFIG: HtmlParseConfig = {
  preset: "custom",
  blockMarker: 'class="DemoCard"',
  imageSrcPattern: YIBIAIGC_DEMO_CARD_CONFIG.imageSrcPattern,
  videoSrcPattern: YIBIAIGC_DEMO_CARD_CONFIG.videoSrcPattern,
  posterPattern: YIBIAIGC_DEMO_CARD_CONFIG.posterPattern,
  titlePattern: YIBIAIGC_DEMO_CARD_CONFIG.titlePattern,
  hotKeyword: "爆款",
};

export type ParsedImportRow = {
  tempKey: string;
  /** 原图 URL（无 x-oss-process） */
  sourceUrl: string;
  /** yibaiaigc 等 CDN 可直拉的缩略图 URL */
  thumbSourceUrl?: string;
  mediaKind: EcomTemplateMediaKind;
  title: string;
  hot: boolean;
  ext: string;
  posterUrl?: string;
  suggestedId: string;
  /** catalog 中已有同品类、同源图条目 */
  alreadyImported?: boolean;
};

function stripProcess(url: string): string {
  return url.split("?")[0] ?? url;
}

function extFromUrl(url: string, mediaKind: EcomTemplateMediaKind): string {
  const path = stripProcess(url);
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
  if (ext) return ext;
  return mediaKind === "video" ? "mp4" : "jpg";
}

export function fileStemFromUrl(url: string): string {
  const path = stripProcess(url);
  const file = path.split("/").pop() ?? "";
  return file.replace(/\.[^.]+$/, "").slice(0, 12);
}

/** 按源图文件名 stem 索引已有 catalog 条目（同品类） */
export function buildExistingStemIndex(
  templates: EcomTemplateGalleryEntry[],
  category: EcomTemplateCategory,
): Map<string, EcomTemplateGalleryEntry> {
  const map = new Map<string, EcomTemplateGalleryEntry>();
  for (const entry of templates) {
    if (entry.category !== category) continue;
    const stem = entry.id.split("-").slice(2).join("-");
    if (stem) map.set(stem, entry);
  }
  return map;
}

function firstCapture(re: RegExp, text: string): string | null {
  const m = text.match(re);
  if (!m) return null;
  for (let i = 1; i < m.length; i++) {
    const v = m[i]?.trim();
    if (v) return v;
  }
  return null;
}

function buildRegex(pattern: string): RegExp {
  return new RegExp(pattern, "i");
}

export function maxCategoryIndex(
  category: EcomTemplateCategory,
  existingIds: string[],
): number {
  const prefix = `${category}-`;
  let max = 0;
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue;
    const rest = id.slice(prefix.length);
    const num = parseInt(rest.split("-")[0] ?? "", 10);
    if (!Number.isNaN(num) && num > max) max = num;
  }
  return max;
}

export function assignSuggestedIds(
  rows: Omit<ParsedImportRow, "suggestedId" | "alreadyImported">[],
  category: EcomTemplateCategory,
  existingTemplates: EcomTemplateGalleryEntry[],
): ParsedImportRow[] {
  const existingIds = existingTemplates.map((t) => t.id);
  const stemIndex = buildExistingStemIndex(existingTemplates, category);
  let index = maxCategoryIndex(category, existingIds);

  return rows.map((row) => {
    const stem = fileStemFromUrl(row.sourceUrl);
    const existing = stemIndex.get(stem);
    if (existing) {
      return {
        ...row,
        suggestedId: existing.id,
        alreadyImported: true,
      };
    }
    index += 1;
    return {
      ...row,
      suggestedId: `${category}-${String(index).padStart(3, "0")}-${stem}`,
      alreadyImported: false,
    };
  });
}

export function parseTemplateGalleryHtml(
  html: string,
  config: HtmlParseConfig,
  category: EcomTemplateCategory,
  existingTemplates: EcomTemplateGalleryEntry[] = [],
  mediaFilter: "all" | EcomTemplateMediaKind = "all",
): ParsedImportRow[] {
  const blocks = html.split(config.blockMarker).slice(1);
  const imageRe = buildRegex(config.imageSrcPattern);
  const videoRe = buildRegex(config.videoSrcPattern);
  const posterRe = config.posterPattern
    ? buildRegex(config.posterPattern)
    : null;
  const titleRe = buildRegex(config.titlePattern);

  const raw: Omit<ParsedImportRow, "suggestedId">[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const videoUrl = firstCapture(videoRe, block);
    const imageUrl = firstCapture(imageRe, block);

    let mediaKind: EcomTemplateMediaKind | null = null;
    let sourceUrl: string | null = null;

    if (videoUrl) {
      mediaKind = "video";
      sourceUrl = stripProcess(videoUrl);
    } else if (imageUrl) {
      mediaKind = "image";
      const split = splitYibaiAigcImageUrl(imageUrl);
      sourceUrl = split.originalUrl;
      raw.push({
        tempKey: `row-${i}-${fileStemFromUrl(split.originalUrl)}`,
        sourceUrl: split.originalUrl,
        thumbSourceUrl: split.thumbSourceUrl,
        mediaKind,
        title: firstCapture(titleRe, block)?.trim() || "模板案例",
        hot: config.hotKeyword ? block.includes(config.hotKeyword) : false,
        ext: extFromUrl(split.originalUrl, mediaKind),
        posterUrl: (() => {
          if (!posterRe) return undefined;
          const p = firstCapture(posterRe, block);
          return p ? stripProcess(p) : undefined;
        })(),
      });
      continue;
    }

    if (!mediaKind || !sourceUrl) continue;
    if (mediaFilter !== "all" && mediaKind !== mediaFilter) continue;

    const title = firstCapture(titleRe, block)?.trim() || "模板案例";
    const hot = config.hotKeyword ? block.includes(config.hotKeyword) : false;
    const posterUrl = posterRe ? firstCapture(posterRe, block) ?? undefined : undefined;

    raw.push({
      tempKey: `row-${i}-${fileStemFromUrl(sourceUrl)}`,
      sourceUrl,
      mediaKind,
      title,
      hot,
      ext: extFromUrl(sourceUrl, mediaKind),
      posterUrl: posterUrl ? stripProcess(posterUrl) : undefined,
    });
  }

  return assignSuggestedIds(raw, category, existingTemplates);
}
