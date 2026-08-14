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

function parseRefImages(raw: unknown): EcomTemplateRefImage[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const url = typeof o.url === "string" ? o.url.trim() : "";
      if (!url) return null;
      const label = typeof o.label === "string" ? o.label : undefined;
      return { url, label };
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

export async function listTemplateGalleryEntriesFromDb(): Promise<EcomTemplateGalleryEntry[]> {
  const delegate = templateDelegate();
  if (!delegate) return [];
  try {
    const rows = await delegate.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    });
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[ecom-template-gallery] list from db failed", e);
    return [];
  }
}

export async function readTemplateGalleryCatalogLive(): Promise<EcomTemplateGalleryCatalog> {
  const fromDb = await listTemplateGalleryEntriesFromDb();
  if (fromDb.length > 0) return { templates: fromDb };
  return readTemplateGalleryCatalog();
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

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
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

  const sourceBuf = await fetchBuffer(originalUrl);
  if (!ossUrl) {
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
      const thumbSource = args.previewExists
        ? await fetchBuffer(ossUrl)
        : sourceBuf;
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
): EcomTemplateGalleryEntry {
  const previewUrl = ossPublicUrlForKeyFromEnv(previewKey);
  const thumbUrl = ossPublicUrlForKeyFromEnv(thumbKey);
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

  const [previewExists, thumbExists] = await Promise.all([
    ossObjectExists(previewKey),
    ossObjectExists(thumbKey),
  ]);

  if (previewExists && (input.mediaKind === "video" || thumbExists)) {
    const existing = findCatalogEntry(input.id);
    const entry =
      existing ??
      entryFromExistingOss(input, previewKey, thumbKey);
    if (!existing) {
      await persistImportedEntry(entry);
    } else {
      await persistImportedEntry(existing);
    }
    return { status: "skipped", entry };
  }

  try {
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
    return { status: "failed", error: message };
  }
}

export function assertTemplateGalleryCatalogReadable(): void {
  readTemplateGalleryCatalog();
}
