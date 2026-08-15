import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Prisma } from "@prisma/client";

import {
  buildEcomTemplateGalleryOssKey,
  buildEcomTemplateGalleryThumbOssKey,
} from "@/lib/canvas/canvas-constants";
import {
  ossObjectExists,
  ossPublicUrlForKeyFromEnv,
  uploadEcomTemplateGalleryPreview,
  uploadEcomTemplateGalleryThumb,
} from "@/lib/canvas/canvas-oss";
import { buildEcomGalleryThumbWebp } from "@/lib/ecom/ecom-gallery-thumb";
import { resolveImageImportUrls } from "@/lib/ecom/ecom-yibaiaigc-image-url";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";
import { prisma } from "@/lib/prisma";

export type EcomTemplateRefImage = { url: string; label?: string };

export type EcomTemplateGalleryEntry = {
  id: string;
  category: string;
  mediaKind: "image" | "video";
  title: string;
  hot: boolean;
  ossUrl: string;
  thumbUrl: string;
  coverUrl?: string | null;
  mainImageUrl?: string | null;
  referenceImages?: EcomTemplateRefImage[];
  promptText?: string | null;
  negativePrompt?: string | null;
  defaultModelKey?: string | null;
  defaultParams?: Record<string, unknown> | null;
  posterUrl?: string | null;
  sortOrder?: number;
};

export type EcomTemplateGalleryCatalog = {
  templates: EcomTemplateGalleryEntry[];
};

/** 分类概览：仅计数，用于驱动分类 / 媒体开关，避免为此拉全量清单 */
export type EcomTemplateCategorySummaryRow = {
  category: string;
  image: number;
  video: number;
  total: number;
};

export type TemplateGalleryUploadInput = {
  category: string;
  mediaKind: "image" | "video";
  id: string;
  sourceUrl: string;
  title: string;
  hot: boolean;
  ext: string;
  posterUrl?: string | null;
  /** yibaiaigc 等：CDN 已处理好的缩略图拉取地址 */
  thumbSourceUrl?: string | null;
};

export type TemplateGalleryUploadResult =
  | { status: "uploaded"; entry: EcomTemplateGalleryEntry }
  | { status: "skipped"; entry: EcomTemplateGalleryEntry }
  | { status: "failed"; error: string };

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function catalogPath(): string {
  const env = process.env.ECOM_TEMPLATE_GALLERY_CATALOG_PATH?.trim();
  if (env) return resolve(env);
  const rel = ["e-commerce-toolkit", "lib", "ecom-template-gallery", "catalog.json"] as const;
  const candidates = [
    resolve(process.cwd(), "..", ...rel),
    resolve(process.cwd(), ...rel),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0]!;
}

export function readTemplateGalleryCatalog(): EcomTemplateGalleryCatalog {
  try {
    const raw = readFileSync(catalogPath(), "utf8");
    const data = JSON.parse(raw) as EcomTemplateGalleryCatalog;
    return { templates: data.templates ?? [] };
  } catch {
    return { templates: [] };
  }
}

export function writeTemplateGalleryCatalog(catalog: EcomTemplateGalleryCatalog): void {
  const path = catalogPath();
  const tmp = `${path}.tmp`;
  const body = JSON.stringify(catalog, null, 2) + "\n";
  writeFileSync(tmp, body, "utf8");
  renameSync(tmp, path);
}

export function appendTemplateGalleryEntries(
  entries: EcomTemplateGalleryEntry[],
): EcomTemplateGalleryCatalog {
  const catalog = readTemplateGalleryCatalog();
  const byId = new Map(catalog.templates.map((t) => [t.id, t]));
  for (const entry of entries) {
    byId.set(entry.id, entry);
  }
  const merged = { templates: Array.from(byId.values()) };
  writeTemplateGalleryCatalog(merged);
  return merged;
}

/** 同时用于解析 DB 的 Json 列与后台接口的请求体，两处规则须一致 */
export function parseRefImages(raw: unknown): EcomTemplateRefImage[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .map((item): EcomTemplateRefImage | null => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const url = typeof o.url === "string" ? o.url.trim() : "";
      if (!url) return null;
      const label = typeof o.label === "string" ? o.label.trim() : "";
      return label ? { url, label } : { url };
    })
    .filter((x): x is EcomTemplateRefImage => x !== null);
  return list.length ? list : undefined;
}

function rowToEntry(row: {
  id: string;
  category: string;
  mediaKind: string;
  title: string;
  hot: boolean;
  ossUrl: string;
  thumbUrl: string;
  coverUrl: string | null;
  mainImageUrl: string | null;
  referenceImages: Prisma.JsonValue;
  promptText: string | null;
  negativePrompt: string | null;
  defaultModelKey: string | null;
  defaultParams: Prisma.JsonValue;
  posterUrl: string | null;
  sortOrder: number;
}): EcomTemplateGalleryEntry {
  return {
    id: row.id,
    category: row.category,
    mediaKind: row.mediaKind === "video" ? "video" : "image",
    title: row.title,
    hot: row.hot,
    ossUrl: row.ossUrl,
    thumbUrl: row.thumbUrl,
    coverUrl: row.coverUrl,
    mainImageUrl: row.mainImageUrl,
    referenceImages: parseRefImages(row.referenceImages),
    promptText: row.promptText,
    negativePrompt: row.negativePrompt,
    defaultModelKey: row.defaultModelKey,
    defaultParams:
      row.defaultParams && typeof row.defaultParams === "object" && !Array.isArray(row.defaultParams)
        ? (row.defaultParams as Record<string, unknown>)
        : null,
    posterUrl: row.posterUrl,
    sortOrder: row.sortOrder,
  };
}

function templateDelegate() {
  return (
    prisma as unknown as {
      ecomTemplateCatalogEntry?: {
        findMany: typeof prisma.ecomTemplateCatalogEntry.findMany;
      };
    }
  ).ecomTemplateCatalogEntry;
}

export async function listTemplateGalleryEntriesFromDb(
  category?: string,
): Promise<EcomTemplateGalleryEntry[]> {
  const delegate = templateDelegate();
  if (!delegate) return [];
  try {
    const rows = await delegate.findMany({
      where: { deletedAt: null, ...(category ? { category } : {}) },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    });
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[ecom-template-gallery] list from db failed", e);
    return [];
  }
}

/**
 * 全量 catalog 已达 1400+ 条 / 700KB+，页面按分类取数以免拉满超时。
 * 不传 category 仍返回全量（管理后台与旧客户端依赖）。
 */
export async function readTemplateGalleryCatalogLive(
  category?: string,
): Promise<EcomTemplateGalleryCatalog> {
  const fromDb = await listTemplateGalleryEntriesFromDb(category);
  if (fromDb.length > 0) return { templates: fromDb };

  // 空库回退打包快照；按分类请求时同样只回该分类
  const snapshot = readTemplateGalleryCatalog();
  if (!category) return snapshot;
  return {
    templates: snapshot.templates.filter((t) => t.category === category),
  };
}

/**
 * 仅取已入库 id 清单，供导入去重与断点续传核对。整条目约 500B，id 约 30B，
 * 故可按 3～15s 轮询。DB 异常时 **抛出**：误判「未导入」会整批重传，
 * 静默回退打包快照比报错更危险（快照缺少后来导入的分类）。
 */
export async function listTemplateGalleryEntryIdsFromDb(
  category?: string,
): Promise<string[]> {
  const rows = await prisma.ecomTemplateCatalogEntry.findMany({
    where: { deletedAt: null, ...(category ? { category } : {}) },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => r.id);
}

export async function getTemplateGalleryCategorySummary(): Promise<
  EcomTemplateCategorySummaryRow[]
> {
  const byCategory = new Map<string, EcomTemplateCategorySummaryRow>();
  const bump = (category: string, mediaKind: string, count: number) => {
    const row = byCategory.get(category) ?? {
      category,
      image: 0,
      video: 0,
      total: 0,
    };
    if (mediaKind === "video") row.video += count;
    else row.image += count;
    row.total += count;
    byCategory.set(category, row);
  };

  try {
    const grouped = await prisma.ecomTemplateCatalogEntry.groupBy({
      by: ["category", "mediaKind"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    for (const g of grouped) bump(g.category, g.mediaKind, g._count._all);
    if (byCategory.size > 0) return Array.from(byCategory.values());
  } catch (e) {
    console.warn("[ecom-template-gallery] category summary from db failed", e);
  }

  for (const t of readTemplateGalleryCatalog().templates) {
    bump(t.category, t.mediaKind, 1);
  }
  return Array.from(byCategory.values());
}

export async function upsertTemplateGalleryEntry(
  entry: EcomTemplateGalleryEntry,
): Promise<EcomTemplateGalleryEntry> {
  const data = {
    category: entry.category,
    mediaKind: entry.mediaKind,
    title: entry.title,
    hot: entry.hot,
    ossUrl: entry.ossUrl,
    thumbUrl: entry.thumbUrl,
    coverUrl: entry.coverUrl ?? null,
    mainImageUrl: entry.mainImageUrl ?? null,
    referenceImages: (entry.referenceImages ?? null) as Prisma.InputJsonValue | undefined,
    promptText: entry.promptText ?? null,
    negativePrompt: entry.negativePrompt ?? null,
    defaultModelKey: entry.defaultModelKey ?? null,
    defaultParams: (entry.defaultParams ?? undefined) as Prisma.InputJsonValue | undefined,
    posterUrl: entry.posterUrl ?? null,
    sortOrder: entry.sortOrder ?? 0,
    deletedAt: null,
  };
  const row = await prisma.ecomTemplateCatalogEntry.upsert({
    where: { id: entry.id },
    create: { id: entry.id, ...data },
    update: data,
  });
  return rowToEntry(row);
}

export async function getTemplateGalleryEntry(
  id: string,
): Promise<EcomTemplateGalleryEntry | null> {
  const row = await prisma.ecomTemplateCatalogEntry.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? rowToEntry(row) : null;
}

export async function deleteTemplateGalleryEntry(
  id: string,
  opts?: { deleteOss?: boolean },
): Promise<boolean> {
  const row = await prisma.ecomTemplateCatalogEntry.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) return false;
  if (opts?.deleteOss) {
    const urls = [row.ossUrl, row.thumbUrl, row.coverUrl, row.mainImageUrl, row.posterUrl].filter(
      (u): u is string => Boolean(u),
    );
    const refs = parseRefImages(row.referenceImages) ?? [];
    for (const url of [...urls, ...refs.map((r) => r.url)]) {
      await deleteManagedOssObjectByUrl(url);
    }
  }
  await prisma.ecomTemplateCatalogEntry.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return true;
}

const SOURCE_FETCH_ATTEMPTS = 4;
const SOURCE_FETCH_RETRY_BASE_MS = 800;
const SOURCE_FETCH_TIMEOUT_MS = 120_000;

/** 源站 4xx：重试无意义 */
class PermanentSourceFetchError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** yibaiaigc CDN 并发拉取时会在 TLS 握手阶段重置连接（ECONNRESET），须重试 */
function isTransientFetchError(e: unknown): boolean {
  const parts: string[] = [];
  let cur: unknown = e;
  for (let depth = 0; depth < 4 && cur != null; depth += 1) {
    if (!(cur instanceof Error)) {
      parts.push(String(cur));
      break;
    }
    parts.push(cur.message);
    const code = (cur as NodeJS.ErrnoException).code;
    if (code) parts.push(code);
    cur = cur.cause;
  }
  return /ECONNRESET|ETIMEDOUT|EPIPE|EAI_AGAIN|ENOTFOUND|ECONNREFUSED|UND_ERR|socket disconnected|socket hang up|secure TLS connection|terminated|fetch failed|aborted|timeout/i.test(
    parts.join(" "),
  );
}

function describeSourceFetchError(url: string, e: unknown): string {
  const cause = e instanceof Error ? e.cause : undefined;
  const code =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as NodeJS.ErrnoException).code)
      : "";
  const detail =
    cause instanceof Error
      ? cause.message
      : e instanceof Error
        ? e.message
        : String(e);
  return `源站拉取失败${code ? ` (${code})` : ""}：${detail} · ${url}`;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= SOURCE_FETCH_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await sleep(SOURCE_FETCH_RETRY_BASE_MS * 2 ** (attempt - 2));
    }
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS),
      });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      const err = new Error(`源站响应 HTTP ${res.status}：${url}`);
      if (res.status !== 429 && res.status < 500) {
        throw new PermanentSourceFetchError(err.message);
      }
      lastError = err;
    } catch (e) {
      if (e instanceof PermanentSourceFetchError) throw e;
      if (!isTransientFetchError(e)) throw new Error(describeSourceFetchError(url, e));
      lastError = e;
    }
  }

  throw new Error(describeSourceFetchError(url, lastError));
}

async function uploadImageThumb(
  category: string,
  id: string,
  sourceBuf: Buffer,
): Promise<string> {
  const thumbBuf = await buildEcomGalleryThumbWebp(sourceBuf);
  return uploadEcomTemplateGalleryThumb({ category, id, buf: thumbBuf });
}

async function uploadVideoThumbFromPoster(
  category: string,
  id: string,
  posterUrl: string,
): Promise<string> {
  const { thumbSourceUrl } = resolveImageImportUrls({ sourceUrl: posterUrl });
  if (thumbSourceUrl) {
    return uploadImageThumbFromRemote(category, id, thumbSourceUrl);
  }
  const buf = await fetchBuffer(posterUrl);
  return uploadImageThumb(category, id, buf);
}

async function uploadImageThumbFromRemote(
  category: string,
  id: string,
  thumbSourceUrl: string,
): Promise<string> {
  const thumbBuf = await fetchBuffer(thumbSourceUrl);
  return uploadEcomTemplateGalleryThumb({ category, id, buf: thumbBuf });
}

async function uploadImagePair(args: {
  input: TemplateGalleryUploadInput;
  ext: string;
  previewKey: string;
  thumbKey: string;
  previewExists: boolean;
  thumbExists: boolean;
}): Promise<{ ossUrl: string; thumbUrl: string }> {
  const { originalUrl, thumbSourceUrl } = resolveImageImportUrls({
    sourceUrl: args.input.sourceUrl,
    thumbSourceUrl: args.input.thumbSourceUrl,
  });

  let ossUrl = args.previewExists
    ? ossPublicUrlForKeyFromEnv(args.previewKey)
    : "";
  let thumbUrl = args.thumbExists
    ? ossPublicUrlForKeyFromEnv(args.thumbKey)
    : "";

  if (args.input.mediaKind === "image" && thumbSourceUrl) {
    const needPreview = !ossUrl;
    const needThumb = !thumbUrl;
    const [previewBuf, thumbBuf] = await Promise.all([
      needPreview ? fetchBuffer(originalUrl) : Promise.resolve(null),
      needThumb ? fetchBuffer(thumbSourceUrl) : Promise.resolve(null),
    ]);
    const uploadTasks: Promise<void>[] = [];
    if (needPreview && previewBuf) {
      uploadTasks.push(
        uploadEcomTemplateGalleryPreview({
          category: args.input.category,
          id: args.input.id,
          buf: previewBuf,
          contentType: MIME[`.${args.ext}`] ?? "image/jpeg",
          ext: args.ext,
        }).then((url) => {
          ossUrl = url;
        }),
      );
    }
    if (needThumb && thumbBuf) {
      uploadTasks.push(
        uploadEcomTemplateGalleryThumb({
          category: args.input.category,
          id: args.input.id,
          buf: thumbBuf,
        }).then((url) => {
          thumbUrl = url;
        }),
      );
    }
    if (uploadTasks.length > 0) {
      await Promise.all(uploadTasks);
    }
    return { ossUrl, thumbUrl };
  }

  // 视频原件可达 10~20MB：仅在确实要上传时才拉取
  const sourceBuf = ossUrl ? null : await fetchBuffer(originalUrl);
  if (!ossUrl && sourceBuf) {
    ossUrl = await uploadEcomTemplateGalleryPreview({
      category: args.input.category,
      id: args.input.id,
      buf: sourceBuf,
      contentType: MIME[`.${args.ext}`] ?? "application/octet-stream",
      ext: args.ext,
    });
  }

  if (!thumbUrl) {
    if (args.input.mediaKind === "image") {
      const thumbSource = sourceBuf ?? (await fetchBuffer(ossUrl));
      thumbUrl = await uploadImageThumb(args.input.category, args.input.id, thumbSource);
    } else if (args.input.posterUrl?.trim()) {
      thumbUrl = await uploadVideoThumbFromPoster(
        args.input.category,
        args.input.id,
        args.input.posterUrl.trim(),
      );
    }
  }

  return { ossUrl, thumbUrl };
}

function entryFromExistingOss(
  input: TemplateGalleryUploadInput,
  previewKey: string,
  thumbKey: string,
  thumbExists: boolean,
): EcomTemplateGalleryEntry {
  const previewUrl = ossPublicUrlForKeyFromEnv(previewKey);
  const thumbUrl = thumbExists ? ossPublicUrlForKeyFromEnv(thumbKey) : "";
  return {
    id: input.id,
    category: input.category,
    mediaKind: input.mediaKind,
    title: input.title,
    hot: input.hot,
    ossUrl: previewUrl,
    thumbUrl,
  };
}

function findCatalogEntry(id: string): EcomTemplateGalleryEntry | undefined {
  return readTemplateGalleryCatalog().templates.find((t) => t.id === id);
}

async function persistImportedEntry(entry: EcomTemplateGalleryEntry): Promise<void> {
  try {
    await upsertTemplateGalleryEntry(entry);
  } catch {
    appendTemplateGalleryEntries([entry]);
  }
}

/** 单条导入：OSS 同名跳过 + catalog 追加 */
export async function importTemplateGalleryItem(
  input: TemplateGalleryUploadInput,
): Promise<TemplateGalleryUploadResult> {
  const ext = input.ext.replace(/^\./, "").toLowerCase() || "jpg";
  const previewKey = buildEcomTemplateGalleryOssKey(
    input.category,
    input.id,
    ext,
  );
  const thumbKey = buildEcomTemplateGalleryThumbOssKey(input.category, input.id);

  // OSS head 也可能瞬时失败；放进 try 内，避免整条路由抛成 500
  try {
    const [previewExists, thumbExists] = await Promise.all([
      ossObjectExists(previewKey),
      ossObjectExists(thumbKey),
    ]);

    // 视频缺封面来源时无法生成缩略图，不能因此每次都重传 mp4
    const canBuildThumb =
      input.mediaKind === "image" || Boolean(input.posterUrl?.trim());

    if (previewExists && (thumbExists || !canBuildThumb)) {
      const existing = findCatalogEntry(input.id);
      const entry =
        existing ??
        entryFromExistingOss(input, previewKey, thumbKey, thumbExists);
      await persistImportedEntry(existing ?? entry);
      return { status: "skipped", entry };
    }

    const { ossUrl, thumbUrl } = await uploadImagePair({
      input,
      ext,
      previewKey,
      thumbKey,
      previewExists,
      thumbExists,
    });

    const entry: EcomTemplateGalleryEntry = {
      id: input.id,
      category: input.category,
      mediaKind: input.mediaKind,
      title: input.title,
      hot: input.hot,
      ossUrl,
      thumbUrl,
    };
    await persistImportedEntry(entry);
    return { status: "uploaded", entry };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(
      `[ecom-template-gallery] import failed ${input.category}/${input.id}: ${message}`,
    );
    return { status: "failed", error: message };
  }
}

export function assertTemplateGalleryCatalogReadable(): void {
  readTemplateGalleryCatalog();
}
