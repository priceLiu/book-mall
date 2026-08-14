import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

export type EcomTemplateGalleryEntry = {
  id: string;
  category: string;
  mediaKind: "image" | "video";
  title: string;
  hot: boolean;
  ossUrl: string;
  thumbUrl: string;
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
  return resolve(
    process.cwd(),
    "..",
    "e-commerce-toolkit",
    "lib",
    "ecom-template-gallery",
    "catalog.json",
  );
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
      appendTemplateGalleryEntries([entry]);
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
    appendTemplateGalleryEntries([entry]);
    return { status: "uploaded", entry };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "failed", error: message };
  }
}

export function assertTemplateGalleryCatalogReadable(): void {
  readTemplateGalleryCatalog();
}
