/* eslint-disable no-console */
/**
 * 从 book-mall/tmp 下品类 HTML 解析模板案例图，上传 OSS（原图 + sharp 缩略图），写入 catalog。
 *
 *   cd book-mall && pnpm ecom:import-template-gallery -- --category shoes
 *   pnpm ecom:import-template-gallery --dry-run -- --category shoes
 *   pnpm ecom:import-template-gallery --skip-existing -- --category shoes
 *   pnpm ecom:import-template-gallery --sync-oss -- --category shoes  # 仅把 OSS 已有条目写入 catalog
 */
import { readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";

import {
  ossObjectExists,
  ossPublicUrlForKeyFromEnv,
  uploadEcomTemplateGalleryPreview,
  uploadEcomTemplateGalleryThumb,
} from "../lib/canvas/canvas-oss";
import { buildEcomTemplateGalleryOssKey, buildEcomTemplateGalleryThumbOssKey } from "../lib/canvas/canvas-constants";
import { buildEcomGalleryThumbWebp } from "../lib/ecom/ecom-gallery-thumb";
import {
  appendTemplateGalleryEntries,
  readTemplateGalleryCatalog,
  writeTemplateGalleryCatalog,
  type EcomTemplateGalleryEntry,
} from "../lib/ecom/ecom-template-gallery-service";
import { splitYibaiAigcImageUrl } from "../lib/ecom/ecom-yibaiaigc-image-url";

const ROOT = resolve(__dirname, "..", "..");

type ImportCategory = "accessories" | "shoes";

const CATEGORY_SOURCES: Record<
  ImportCategory,
  { label: string; htmlPath: string }
> = {
  accessories: {
    label: "配饰",
    htmlPath: resolve(ROOT, "book-mall", "tmp", "配饰 图片.html"),
  },
  shoes: {
    label: "鞋子",
    htmlPath: resolve(ROOT, "book-mall", "tmp", "pic", "鞋子 图片.html"),
  },
};

type ParsedRow = {
  id: string;
  sourceUrl: string;
  thumbSourceUrl?: string;
  ext: string;
  title: string;
  hot: boolean;
};

const IMPORT_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.ECOM_IMPORT_CONCURRENCY ?? "10", 10) || 10,
);

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function parseArgvCategory(): ImportCategory {
  const idx = process.argv.indexOf("--category");
  const raw = idx >= 0 ? process.argv[idx + 1]?.trim() : "";
  if (raw === "shoes") return "shoes";
  if (raw === "accessories") return "accessories";
  if (raw && raw !== "accessories") {
    console.error(
      `[import-template-gallery] unknown --category ${raw} (supported: accessories, shoes)`,
    );
    process.exit(1);
  }
  return "accessories";
}

function stripProcess(url: string): string {
  return url.split("?")[0] ?? url;
}

function extFromUrl(url: string): string {
  const path = stripProcess(url);
  const ext = extname(path).replace(/^\./, "").toLowerCase();
  return ext || "jpg";
}

function fileStemFromUrl(url: string): string {
  const path = stripProcess(url);
  const file = path.split("/").pop() ?? "";
  return file.replace(/\.[^.]+$/, "").slice(0, 12);
}

function parseDemoCardHtml(html: string, category: ImportCategory): ParsedRow[] {
  const blocks = html.split('class="DemoCard"').slice(1);
  const rows: ParsedRow[] = [];
  let index = 0;

  for (const block of blocks) {
    const srcMatch =
      block.match(
        /class="media-image"[^>]*src="(https:\/\/image\.yibaiaigc[^"]+)"/,
      ) ??
      block.match(
        /src="(https:\/\/image\.yibaiaigc[^"]+)"[^>]*class="media-image"/,
      );
    if (!srcMatch) continue;

    index += 1;
    const split = splitYibaiAigcImageUrl(srcMatch[1]!);
    const sourceUrl = split.originalUrl;
    const bannerMatch = block.match(
      /DemoCard-banner[\s\S]*?<span[^>]*>([^<]+)<\/span>/,
    );
    const title = bannerMatch?.[1]?.trim() || "模板案例";
    const hot = block.includes("爆款");

    rows.push({
      id: `${category}-${String(index).padStart(3, "0")}-${fileStemFromUrl(sourceUrl)}`,
      sourceUrl,
      thumbSourceUrl: split.thumbSourceUrl,
      ext: extFromUrl(sourceUrl),
      title,
      hot,
    });
  }

  return rows;
}

function loadCatalogTemplates(): EcomTemplateGalleryEntry[] {
  return readTemplateGalleryCatalog().templates;
}

function loadExistingCatalog(): Map<string, EcomTemplateGalleryEntry> {
  const map = new Map<string, EcomTemplateGalleryEntry>();
  for (const row of loadCatalogTemplates()) {
    if (row.id && row.ossUrl) map.set(row.id, row);
  }
  return map;
}

async function resolveExistingOssEntry(
  row: ParsedRow,
  category: ImportCategory,
): Promise<EcomTemplateGalleryEntry | null> {
  try {
    const previewKey = buildEcomTemplateGalleryOssKey(category, row.id, row.ext);
    const thumbKey = buildEcomTemplateGalleryThumbOssKey(category, row.id);
    const [previewExists, thumbExists] = await Promise.all([
      ossObjectExists(previewKey),
      ossObjectExists(thumbKey),
    ]);
    if (!previewExists || !thumbExists) return null;
    return {
      id: row.id,
      category,
      mediaKind: "image",
      title: row.title,
      hot: row.hot,
      ossUrl: ossPublicUrlForKeyFromEnv(previewKey),
      thumbUrl: ossPublicUrlForKeyFromEnv(thumbKey),
    };
  } catch (e) {
    console.warn(`[warn] oss head ${row.id}`, e);
    return null;
  }
}

function loadExistingOtherCategories(category: ImportCategory): EcomTemplateGalleryEntry[] {
  return loadCatalogTemplates().filter((t) => t.category !== category);
}

const FETCH_RETRIES = 3;

let catalogWriteChain = Promise.resolve();

function appendCatalogEntry(entry: EcomTemplateGalleryEntry): void {
  catalogWriteChain = catalogWriteChain
    .then(() => {
      appendTemplateGalleryEntries([entry]);
    })
    .catch((e) => {
      console.error(`[fail] catalog append ${entry.id}`, e);
    });
}

async function flushCatalogWrites(): Promise<void> {
  await catalogWriteChain;
}

function importProgressPath(category: string): string {
  return resolve(ROOT, "book-mall", "tmp", `ecom-import-${category}-progress.json`);
}

function countCategoryReady(
  rows: ParsedRow[],
  existing: Map<string, EcomTemplateGalleryEntry>,
): number {
  return rows.filter((r) => {
    const e = existing.get(r.id);
    return Boolean(e?.ossUrl?.trim() && e?.thumbUrl?.trim());
  }).length;
}

function syncImportProgress(args: {
  category: ImportCategory;
  rows: ParsedRow[];
  existing: Map<string, EcomTemplateGalleryEntry>;
  uploaded: number;
  skipped: number;
  failed: number;
  lastId?: string;
  forceLog?: boolean;
}): void {
  const ready = countCategoryReady(args.rows, args.existing);
  const total = args.rows.length;
  const pct = total > 0 ? Math.round((ready / total) * 100) : 0;
  const body = {
    category: args.category,
    ready,
    total,
    percent: pct,
    uploaded: args.uploaded,
    skipped: args.skipped,
    failed: args.failed,
    lastId: args.lastId ?? null,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(importProgressPath(args.category), JSON.stringify(body, null, 2) + "\n");

  if (args.forceLog || ready % 5 === 0 || ready === total) {
    console.log(
      `[progress] ${args.category} ${ready}/${total} (${pct}%) · uploaded=${args.uploaded} skipped=${args.skipped} failed=${args.failed}${args.lastId ? ` · last=${args.lastId}` : ""}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchBuffer(url: string, attempt = 1): Promise<Buffer> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    if (attempt >= FETCH_RETRIES) throw e;
    const wait = 800 * attempt;
    console.warn(`[warn] fetch retry ${attempt}/${FETCH_RETRIES} ${url}`);
    await sleep(wait);
    return fetchBuffer(url, attempt + 1);
  }
}

async function uploadThumbFromRemote(
  category: string,
  id: string,
  thumbSourceUrl: string,
): Promise<string> {
  const buf = await fetchBuffer(thumbSourceUrl);
  return uploadEcomTemplateGalleryThumb({ category, id, buf });
}

async function uploadThumbFromBuffer(
  category: string,
  id: string,
  sourceBuf: Buffer,
): Promise<string> {
  const thumbBuf = await buildEcomGalleryThumbWebp(sourceBuf);
  return uploadEcomTemplateGalleryThumb({ category, id, buf: thumbBuf });
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return out;
}

async function backfillThumbs(
  entries: EcomTemplateGalleryEntry[],
  dryRun: boolean,
): Promise<{ updated: EcomTemplateGalleryEntry[]; uploaded: number; skipped: number; failed: number }> {
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  const updated = await mapPool(entries, IMPORT_CONCURRENCY, async (entry) => {
    if (entry.thumbUrl?.trim()) {
      skipped += 1;
      return entry;
    }
    if (!entry.ossUrl?.trim()) {
      failed += 1;
      console.error(`[fail] ${entry.id} missing ossUrl`);
      return entry;
    }

    if (dryRun) {
      uploaded += 1;
      console.log(`[dry-run] thumb ${entry.id} ← ${entry.ossUrl}`);
      return {
        ...entry,
        thumbUrl: `https://example.com/ecom/template-gallery/${entry.category}/${entry.id}-thumb.webp`,
      };
    }

    try {
      const buf = await fetchBuffer(entry.ossUrl);
      const thumbUrl = await uploadThumbFromBuffer(entry.category, entry.id, buf);
      uploaded += 1;
      console.log(`[ok] thumb ${entry.id} → ${thumbUrl}`);
      return { ...entry, thumbUrl };
    } catch (e) {
      failed += 1;
      console.error(`[fail] thumb ${entry.id}`, e);
      return entry;
    }
  });

  return { updated, uploaded, skipped, failed };
}

async function syncCatalogFromOss(
  rows: ParsedRow[],
  category: ImportCategory,
  dryRun: boolean,
): Promise<void> {
  console.log(
    `[import-template-gallery] sync-oss · scanning ${rows.length} ${category} rows`,
  );
  let found = 0;
  const entries = await mapPool(rows, IMPORT_CONCURRENCY, async (row) => {
    const entry = await resolveExistingOssEntry(row, category);
    if (entry && !dryRun) appendCatalogEntry(entry);
    return entry;
  });
  const synced = entries.filter((e): e is EcomTemplateGalleryEntry => e !== null);
  found = synced.length;
  if (!dryRun) {
    await flushCatalogWrites();
    const others = loadExistingOtherCategories(category);
    const byId = new Map<string, EcomTemplateGalleryEntry>();
    for (const t of others) byId.set(t.id, t);
    for (const t of synced) byId.set(t.id, t);
    writeTemplateGalleryCatalog({ templates: Array.from(byId.values()) });
    console.log("[import-template-gallery] wrote catalog.json");
  }
  console.log(
    `[import-template-gallery] sync-oss done · found=${found} / ${rows.length}`,
  );
}

async function main() {
  const category = parseArgvCategory();
  const source = CATEGORY_SOURCES[category];
  const dryRun = process.argv.includes("--dry-run");
  const skipExisting = process.argv.includes("--skip-existing");
  const thumbOnly = process.argv.includes("--thumb-only");
  const syncOss = process.argv.includes("--sync-oss");

  const html = readFileSync(source.htmlPath, "utf8");
  const rows = parseDemoCardHtml(html, category);

  if (syncOss) {
    await syncCatalogFromOss(rows, category, dryRun);
    return;
  }

  if (thumbOnly) {
    const all = loadCatalogTemplates();
    const targets = all.filter((t) => t.category === category && t.ossUrl);
    console.log(
      `[import-template-gallery] thumb-only · ${targets.length} ${category} rows`,
    );
    const { updated, uploaded, skipped, failed } = await backfillThumbs(
      targets,
      dryRun,
    );

    if (!dryRun) {
      const others = all.filter((t) => t.category !== category);
      const byId = new Map(updated.map((t) => [t.id, t]));
      const templates = [
        ...others,
        ...all
          .filter((t) => t.category === category)
          .map((t) => byId.get(t.id) ?? t),
      ];
      writeTemplateGalleryCatalog({ templates });
      console.log("[import-template-gallery] wrote catalog.json");
    }

    console.log(
      `[import-template-gallery] thumb-only done · uploaded=${uploaded} skipped=${skipped} failed=${failed}`,
    );
    if (failed > 0) process.exitCode = 1;
    return;
  }

  console.log(
    `[import-template-gallery] parsed ${rows.length} ${category} (${source.label}) rows from ${source.htmlPath}`,
  );

  const existing = skipExisting ? loadExistingCatalog() : new Map<string, EcomTemplateGalleryEntry>();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  syncImportProgress({
    category,
    rows,
    existing,
    uploaded,
    skipped,
    failed,
    forceLog: true,
  });

  const imported = await mapPool(rows, IMPORT_CONCURRENCY, async (row) => {
    const prev = existing.get(row.id);
    if (prev?.ossUrl && prev?.thumbUrl) {
      skipped += 1;
      syncImportProgress({ category, rows, existing, uploaded, skipped, failed, lastId: row.id });
      return prev;
    }

    if (skipExisting) {
      const ossEntry = await resolveExistingOssEntry(row, category);
      if (ossEntry) {
        skipped += 1;
        console.log(`[skip] ${row.id} (oss exists)`);
        appendCatalogEntry(ossEntry);
        existing.set(row.id, ossEntry);
        syncImportProgress({ category, rows, existing, uploaded, skipped, failed, lastId: row.id });
        return ossEntry;
      }
    }

    if (dryRun) {
      uploaded += 1;
      console.log(
        `[dry-run] ${row.id} → ecom/template-gallery/${category}/${row.id}.${row.ext} + thumb`,
      );
      return {
        id: row.id,
        category,
        mediaKind: "image" as const,
        title: row.title,
        hot: row.hot,
        ossUrl: `https://example.com/ecom/template-gallery/${category}/${row.id}.${row.ext}`,
        thumbUrl: `https://example.com/ecom/template-gallery/${category}/${row.id}-thumb.webp`,
      };
    }

    try {
      let sourceBuf: Buffer;
      let ossUrl = prev?.ossUrl ?? "";

      if (ossUrl) {
        sourceBuf = await fetchBuffer(ossUrl);
      } else {
        sourceBuf = await fetchBuffer(row.sourceUrl);
        const mime = MIME[`.${row.ext}`] ?? "image/jpeg";
        ossUrl = await uploadEcomTemplateGalleryPreview({
          category,
          id: row.id,
          buf: sourceBuf,
          contentType: mime,
          ext: row.ext,
        });
        console.log(`[ok] ${row.id} → ${ossUrl}`);
      }

      let thumbUrl = prev?.thumbUrl ?? "";
      if (!thumbUrl) {
        if (row.thumbSourceUrl) {
          thumbUrl = await uploadThumbFromRemote(category, row.id, row.thumbSourceUrl);
        } else {
          const thumbSource = ossUrl ? await fetchBuffer(ossUrl) : sourceBuf;
          thumbUrl = await uploadThumbFromBuffer(category, row.id, thumbSource);
        }
        console.log(`[ok] thumb ${row.id} → ${thumbUrl}`);
      }

      uploaded += 1;
      const entry: EcomTemplateGalleryEntry = {
        id: row.id,
        category,
        mediaKind: "image" as const,
        title: row.title,
        hot: row.hot,
        ossUrl,
        thumbUrl,
      };
      appendCatalogEntry(entry);
      existing.set(row.id, entry);
      syncImportProgress({ category, rows, existing, uploaded, skipped, failed, lastId: row.id });
      return entry;
    } catch (e) {
      failed += 1;
      console.error(`[fail] ${row.id}`, e);
      syncImportProgress({ category, rows, existing, uploaded, skipped, failed, lastId: row.id });
      return prev ?? null;
    }
  });

  const categoryRows = imported.filter((e): e is EcomTemplateGalleryEntry => e !== null);
  const others = skipExisting ? loadExistingOtherCategories(category) : [];
  const templates = [...others, ...categoryRows];

  if (!dryRun) {
    await flushCatalogWrites();
    writeTemplateGalleryCatalog({ templates });
    console.log("[import-template-gallery] wrote catalog.json");
  }

  syncImportProgress({
    category,
    rows,
    existing,
    uploaded,
    skipped,
    failed,
    forceLog: true,
  });

  console.log(
    `[import-template-gallery] done · ${category}=${categoryRows.length} uploaded=${uploaded} skipped=${skipped} failed=${failed} total=${templates.length}`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
