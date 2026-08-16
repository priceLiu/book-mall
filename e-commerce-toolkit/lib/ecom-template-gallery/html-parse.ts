import type {
  EcomTemplateCategory,
  EcomTemplateEntryRef,
  EcomTemplateMediaKind,
} from "./types";
import {
  deriveVideoUrlFromCoverUrl,
  splitYibaiAigcImageUrl,
} from "./yibaiaigc-image-url";

export {
  inferTemplateCategoryFromFilename,
  templateCategoryLabel,
} from "./types";

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
  /** 视频 URL 由封面同名推导（HTML 内 `<video src>` 为空） */
  videoUrlDerived?: boolean;
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

/** catalog id 末尾 stem（支持 home-textile 等多段品类 id） */
export function catalogEntryStemFromId(id: string): string | null {
  const m = id.match(/^(.+)-(\d{3})-(.+)$/);
  return m?.[3] ?? null;
}

/** 按源图文件名 stem 索引已有 catalog 条目（同品类） */
export function buildExistingStemIndex(
  templates: readonly EcomTemplateEntryRef[],
  category: EcomTemplateCategory,
): Map<string, EcomTemplateEntryRef> {
  const map = new Map<string, EcomTemplateEntryRef>();
  for (const entry of templates) {
    if (entry.category !== category) continue;
    const stem = catalogEntryStemFromId(entry.id);
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
  existingTemplates: readonly EcomTemplateEntryRef[],
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
  existingTemplates: readonly EcomTemplateEntryRef[] = [],
  mediaFilter: "all" | EcomTemplateMediaKind = "all",
): ParsedImportRow[] {
  const blocks = html.split(config.blockMarker).slice(1);
  const imageRe = buildRegex(config.imageSrcPattern);
  const videoRe = buildRegex(config.videoSrcPattern);
  const posterRe = config.posterPattern
    ? buildRegex(config.posterPattern)
    : null;
  const titleRe = buildRegex(config.titlePattern);

  type RawRow = Omit<ParsedImportRow, "suggestedId" | "alreadyImported">;
  const raw: RawRow[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const explicitVideoUrl = firstCapture(videoRe, block);
    const imageUrl = firstCapture(imageRe, block);
    // 封面优先取 poster 属性；yibaiaigc 无 poster，封面是同块的 media-image
    const coverUrl = (posterRe ? firstCapture(posterRe, block) : null) ?? imageUrl;

    const base = {
      tempKey: "",
      title: firstCapture(titleRe, block)?.trim() || "模板案例",
      hot: config.hotKeyword ? block.includes(config.hotKeyword) : false,
    };

    let row: RawRow | null = null;

    if (explicitVideoUrl) {
      const sourceUrl = stripProcess(explicitVideoUrl);
      row = {
        ...base,
        sourceUrl,
        mediaKind: "video",
        ext: extFromUrl(sourceUrl, "video"),
        posterUrl: coverUrl ? stripProcess(coverUrl) : undefined,
      };
    } else if (mediaFilter === "video" && coverUrl) {
      const sourceUrl = deriveVideoUrlFromCoverUrl(coverUrl);
      if (sourceUrl) {
        row = {
          ...base,
          sourceUrl,
          mediaKind: "video",
          ext: extFromUrl(sourceUrl, "video"),
          posterUrl: stripProcess(coverUrl),
          videoUrlDerived: true,
        };
      }
    } else if (imageUrl) {
      const split = splitYibaiAigcImageUrl(imageUrl);
      row = {
        ...base,
        sourceUrl: split.originalUrl,
        thumbSourceUrl: split.thumbSourceUrl,
        mediaKind: "image",
        ext: extFromUrl(split.originalUrl, "image"),
      };
    }

    if (!row) continue;
    if (mediaFilter !== "all" && row.mediaKind !== mediaFilter) continue;

    raw.push({ ...row, tempKey: `row-${i}-${fileStemFromUrl(row.sourceUrl)}` });
  }

  return assignSuggestedIds(raw, category, existingTemplates);
}
